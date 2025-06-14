import { logger } from './logger';
import { gracefulShutdown, emergencyCleanup } from '../cli/cleanup';
import { AmplifyErrorHandler } from './errorHandler';

export interface SignalHandlerOptions {
  gracefulTimeoutMs?: number;
  emergencyTimeoutMs?: number;
  signals?: NodeJS.Signals[];
}

export class SignalHandler {
  private isShuttingDown = false;
  private handlers: Map<NodeJS.Signals, () => void> = new Map();
  private options: Required<SignalHandlerOptions>;

  constructor(options: SignalHandlerOptions = {}) {
    this.options = {
      gracefulTimeoutMs: options.gracefulTimeoutMs || 10000, // 10 seconds
      emergencyTimeoutMs: options.emergencyTimeoutMs || 5000, // 5 seconds  
      signals: options.signals || ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGQUIT']
    };
  }

  /**
   * Set up signal handlers for graceful shutdown
   */
  setup(): void {
    this.options.signals.forEach(signal => {
      const handler = () => this.handleSignal(signal);
      this.handlers.set(signal, handler);
      process.on(signal, handler);
      logger.debug(`Signal handler registered for ${signal}`);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      this.handleCriticalError('uncaughtException', error);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled promise rejection:', { reason, promise });
      this.handleCriticalError('unhandledRejection', reason instanceof Error ? reason : new Error(String(reason)));
    });

    logger.debug('Signal handlers setup completed');
  }

  /**
   * Clean up signal handlers
   */
  cleanup(): void {
    this.handlers.forEach((handler, signal) => {
      process.removeListener(signal, handler);
    });
    this.handlers.clear();
    logger.debug('Signal handlers cleaned up');
  }

  /**
   * Handle incoming signals
   */
  private async handleSignal(signal: NodeJS.Signals): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn(`Received ${signal} signal during shutdown, forcing exit...`);
      await this.forceExit();
      return;
    }

    this.isShuttingDown = true;
    logger.info(`\n🛑 Received ${signal} signal, initiating graceful shutdown...`);

    try {
      // Attempt graceful shutdown with timeout
      const shutdownPromise = gracefulShutdown();
      const timeoutPromise = new Promise<void>((_, reject) => 
        setTimeout(() => reject(new Error('Graceful shutdown timeout')), this.options.gracefulTimeoutMs)
      );

      await Promise.race([shutdownPromise, timeoutPromise]);
      
      AmplifyErrorHandler.success('Graceful shutdown completed');
      process.exit(0);

    } catch (error) {
      logger.error('Graceful shutdown failed:', error);
      AmplifyErrorHandler.warn(
        'Graceful shutdown failed, attempting emergency cleanup...',
        ['Some resources may not be cleaned up properly']
      );

      await this.performEmergencyShutdown();
    }
  }

  /**
   * Handle critical errors that require immediate shutdown
   */
  private async handleCriticalError(type: string, error: Error): Promise<void> {
    if (this.isShuttingDown) {
      console.error(`Critical error during shutdown (${type}):`, error.message);
      process.exit(1);
      return;
    }

    this.isShuttingDown = true;
    console.error(`\n🚨 Critical error (${type}): ${error.message}`);
    console.error('Attempting emergency cleanup...');

    await this.performEmergencyShutdown();
  }

  /**
   * Perform emergency shutdown
   */
  private async performEmergencyShutdown(): Promise<void> {
    try {
      const emergencyPromise = emergencyCleanup();
      const timeoutPromise = new Promise<void>((_, reject) => 
        setTimeout(() => reject(new Error('Emergency cleanup timeout')), this.options.emergencyTimeoutMs)
      );

      await Promise.race([emergencyPromise, timeoutPromise]);
      console.error('Emergency cleanup completed');
      
    } catch (error) {
      console.error('Emergency cleanup failed:', error);
      console.error('⚠️  Some resources may still be running');
    } finally {
      process.exit(1);
    }
  }

  /**
   * Force immediate exit
   */
  private async forceExit(): Promise<void> {
    console.error('\n🚨 Force exiting...');
    
    // Give a very short time for any final cleanup
    setTimeout(() => {
      console.error('⚠️  Resources may still be running - manual cleanup may be required');
      process.exit(2);
    }, 1000);

    try {
      await emergencyCleanup();
    } catch (error) {
      // Ignore errors during force exit
    }
    
    process.exit(2);
  }

  /**
   * Programmatically trigger shutdown
   */
  async triggerShutdown(reason?: string): Promise<void> {
    if (reason) {
      logger.info(`Shutdown triggered: ${reason}`);
    }
    await this.handleSignal('SIGTERM');
  }
}

// Global signal handler instance
let globalSignalHandler: SignalHandler | null = null;

/**
 * Set up global signal handlers
 */
export function setupSignalHandlers(options?: SignalHandlerOptions): SignalHandler {
  if (globalSignalHandler) {
    logger.warn('Signal handlers already setup, cleaning up previous handlers');
    globalSignalHandler.cleanup();
  }

  globalSignalHandler = new SignalHandler(options);
  globalSignalHandler.setup();
  
  return globalSignalHandler;
}

/**
 * Clean up global signal handlers
 */
export function cleanupSignalHandlers(): void {
  if (globalSignalHandler) {
    globalSignalHandler.cleanup();
    globalSignalHandler = null;
  }
}

/**
 * Get the global signal handler instance
 */
export function getSignalHandler(): SignalHandler | null {
  return globalSignalHandler;
}

/**
 * Programmatically trigger shutdown
 */
export async function triggerShutdown(reason?: string): Promise<void> {
  if (globalSignalHandler) {
    await globalSignalHandler.triggerShutdown(reason);
  } else {
    logger.warn('No signal handler available for shutdown trigger');
    process.exit(0);
  }
}
