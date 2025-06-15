/**
 * TTL cleanup job implementation for sessions and containers
 */

import { EventEmitter } from 'events';
import { SessionStore } from './sessionStore';
import { Session, SessionStatus } from '../models/Session';
import { ContainerManager } from '../docker/containerManager';
import { logger } from '../utils/logger';

const cleanupLogger = logger.child('CleanupService');

export interface CleanupConfig {
  sessionCheckInterval: number; // How often to check for expired sessions (ms)
  containerGracePeriod: number; // Grace period before forcefully stopping containers (ms)
  maxRetries: number; // Maximum retries for container cleanup
  batchSize: number; // Number of sessions to process in each batch
}

export class CleanupService extends EventEmitter {
  private sessionStore: SessionStore;
  private containerManager: ContainerManager;
  private config: CleanupConfig;
  private cleanupTimer?: NodeJS.Timeout | undefined;
  private isRunning: boolean = false;

  constructor(
    sessionStore: SessionStore,
    containerManager: ContainerManager,
    config: Partial<CleanupConfig> = {}
  ) {
    super();
    
    this.sessionStore = sessionStore;
    this.containerManager = containerManager;
    this.config = {
      sessionCheckInterval: config.sessionCheckInterval || 5 * 60 * 1000, // 5 minutes
      containerGracePeriod: config.containerGracePeriod || 30 * 1000, // 30 seconds
      maxRetries: config.maxRetries || 3,
      batchSize: config.batchSize || 10,
      ...config
    };

    this.setupEventListeners();
    cleanupLogger.info('CleanupService initialized', this.config);
  }

  /**
   * Start the cleanup service
   */
  start(): void {
    if (this.isRunning) {
      cleanupLogger.warn('CleanupService is already running');
      return;
    }

    this.isRunning = true;
    this.startCleanupTimer();
    cleanupLogger.info('CleanupService started');
  }

  /**
   * Stop the cleanup service
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    cleanupLogger.info('CleanupService stopped');
  }

  /**
   * Manually trigger a cleanup cycle
   */
  async runCleanup(): Promise<void> {
    if (!this.isRunning) {
      cleanupLogger.warn('CleanupService is not running');
      return;
    }

    try {
      cleanupLogger.info('Starting cleanup cycle');
      
      // Find expired sessions
      const expiredSessions = this.sessionStore.findExpiredSessions();
      
      if (expiredSessions.length === 0) {
        cleanupLogger.debug('No expired sessions found');
        return;
      }

      cleanupLogger.info(`Found ${expiredSessions.length} expired sessions to cleanup`);

      // Process sessions in batches
      for (let i = 0; i < expiredSessions.length; i += this.config.batchSize) {
        const batch = expiredSessions.slice(i, i + this.config.batchSize);
        await this.processBatch(batch);
      }

      cleanupLogger.info('Cleanup cycle completed');
      this.emit('cleanupCompleted', { processedSessions: expiredSessions.length });

    } catch (error) {
      cleanupLogger.error('Error during cleanup cycle:', error);
      this.emit('cleanupError', error);
    }
  }

  /**
   * Clean up a specific session
   */
  async cleanupSession(sessionId: string): Promise<boolean> {
    const session = this.sessionStore.getSession(sessionId);
    if (!session) {
      cleanupLogger.warn(`Session not found for cleanup: ${sessionId}`);
      return false;
    }

    try {
      cleanupLogger.info(`Cleaning up session: ${sessionId}`, {
        userId: session.userId,
        repository: session.repositoryName,
        status: session.status
      });

      // Update session status to stopping
      this.sessionStore.updateSession(sessionId, {
        status: SessionStatus.STOPPING
      });

      // Stop and remove container if it exists
      if (session.containerId) {
        await this.cleanupContainer(session.containerId, session.containerName);
      }

      // Remove session from store
      this.sessionStore.deleteSession(sessionId);

      cleanupLogger.info(`Session cleanup completed: ${sessionId}`);
      this.emit('sessionCleaned', session);
      return true;

    } catch (error) {
      cleanupLogger.error(`Failed to cleanup session ${sessionId}:`, error);
      
      // Update session status to error
      this.sessionStore.updateSession(sessionId, {
        status: SessionStatus.ERROR,
        metadata: {
          ...session.metadata,
          errorCount: (session.metadata.errorCount || 0) + 1
        }
      });

      this.emit('sessionCleanupError', session, error);
      return false;
    }
  }

  /**
   * Process a batch of expired sessions
   */
  private async processBatch(sessions: Session[]): Promise<void> {
    const cleanupPromises = sessions.map(session => 
      this.cleanupSession(session.id)
    );

    const results = await Promise.allSettled(cleanupPromises);
    
    const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
    const failed = results.length - successful;

    cleanupLogger.info(`Batch cleanup completed`, {
      total: sessions.length,
      successful,
      failed
    });

    if (failed > 0) {
      const failures = results
        .map((r, i) => ({ result: r, session: sessions[i] }))
        .filter(({ result, session }) => session && (result.status === 'rejected' || !result.value))
        .map(({ session }) => session!.id);

      cleanupLogger.warn(`Failed to cleanup sessions: ${failures.join(', ')}`);
    }
  }

  /**
   * Clean up a Docker container
   */
  private async cleanupContainer(containerId: string, containerName?: string): Promise<void> {
    try {
      cleanupLogger.debug(`Cleaning up container: ${containerId}`, { containerName });

      // Use the container manager's stopContainer method which handles stop and remove
      const success = await this.containerManager.stopContainer(containerId);
      
      if (!success) {
        throw new Error(`Failed to stop and remove container: ${containerId}`);
      }

      cleanupLogger.debug(`Container cleanup completed: ${containerId}`);

    } catch (error) {
      cleanupLogger.error(`Failed to cleanup container ${containerId}:`, error);
      throw error;
    }
  }

  /**
   * Set up event listeners for session store events
   */
  private setupEventListeners(): void {
    // Listen for session expiry events from the session store
    this.sessionStore.on('sessionExpired', (session: Session) => {
      cleanupLogger.info(`Session expired, scheduling cleanup: ${session.id}`);
      
      // Schedule async cleanup (don't wait for it)
      setImmediate(() => {
        this.cleanupSession(session.id).catch(error => {
          cleanupLogger.error(`Failed to cleanup expired session ${session.id}:`, error);
        });
      });
    });

    // Listen for session deletion events to clean up containers
    this.sessionStore.on('sessionDeleted', (session: Session) => {
      if (session.containerId && session.status !== SessionStatus.STOPPED) {
        cleanupLogger.info(`Session deleted with active container, scheduling cleanup: ${session.id}`);
        
        setImmediate(() => {
          if (session.containerId) {
            this.cleanupContainer(session.containerId, session.containerName).catch(error => {
              cleanupLogger.error(`Failed to cleanup container for deleted session ${session.id}:`, error);
            });
          }
        });
      }
    });
  }

  /**
   * Start the periodic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.runCleanup().catch(error => {
        cleanupLogger.error('Scheduled cleanup failed:', error);
      });
    }, this.config.sessionCheckInterval);

    cleanupLogger.info(`Cleanup timer started with interval: ${this.config.sessionCheckInterval}ms`);
  }

  /**
   * Get cleanup service statistics
   */
  getStats(): {
    isRunning: boolean;
    config: CleanupConfig;
    nextCleanup?: Date | undefined;
  } {
    return {
      isRunning: this.isRunning,
      config: this.config,
      nextCleanup: this.cleanupTimer 
        ? new Date(Date.now() + this.config.sessionCheckInterval)
        : undefined
    };
  }

  /**
   * Clean up resources and stop the service
   */
  destroy(): void {
    this.stop();
    this.removeAllListeners();
    cleanupLogger.info('CleanupService destroyed');
  }
}
