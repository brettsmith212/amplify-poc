import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface TerminalControlSignal {
  signal: 'SIGINT' | 'SIGTERM' | 'SIGKILL' | 'SIGTSTP' | 'SIGCONT' | 'SIGQUIT';
  sessionId: string;
  timestamp: number;
}

export interface TerminalResizeEvent {
  sessionId: string;
  cols: number;
  rows: number;
  timestamp: number;
}

export interface TerminalControlOptions {
  enableSignalHandling?: boolean;
  enableResizeHandling?: boolean;
  debounceResizeMs?: number;
  maxCols?: number;
  maxRows?: number;
  minCols?: number;
  minRows?: number;
}

export class TerminalControl extends EventEmitter {
  private options: Required<TerminalControlOptions>;
  private resizeTimers: Map<string, NodeJS.Timeout> = new Map();
  private lastResizeEvents: Map<string, TerminalResizeEvent> = new Map();

  constructor(options: TerminalControlOptions = {}) {
    super();
    
    this.options = {
      enableSignalHandling: options.enableSignalHandling ?? true,
      enableResizeHandling: options.enableResizeHandling ?? true,
      debounceResizeMs: options.debounceResizeMs ?? 100,
      maxCols: options.maxCols ?? 200,
      maxRows: options.maxRows ?? 100,
      minCols: options.minCols ?? 10,
      minRows: options.minRows ?? 5
    };

    logger.debug('Terminal control initialized', this.options);
  }

  /**
   * Handle a control signal for a terminal session
   */
  handleControlSignal(signal: TerminalControlSignal): boolean {
    if (!this.options.enableSignalHandling) {
      logger.debug(`Signal handling disabled, ignoring ${signal.signal} for session ${signal.sessionId}`);
      return false;
    }

    if (!this.isValidSignal(signal.signal)) {
      logger.warn(`Invalid signal received: ${signal.signal} for session ${signal.sessionId}`);
      return false;
    }

    logger.info(`Processing control signal ${signal.signal} for session ${signal.sessionId}`);

    // Emit signal event for handlers to process
    this.emit('signal', signal);

    // Handle specific signals
    switch (signal.signal) {
      case 'SIGINT':
        this.emit('interrupt', signal);
        break;
      case 'SIGTERM':
        this.emit('terminate', signal);
        break;
      case 'SIGKILL':
        this.emit('kill', signal);
        break;
      case 'SIGTSTP':
        this.emit('suspend', signal);
        break;
      case 'SIGCONT':
        this.emit('continue', signal);
        break;
      case 'SIGQUIT':
        this.emit('quit', signal);
        break;
    }

    return true;
  }

  /**
   * Handle a terminal resize event with debouncing
   */
  handleResizeEvent(resizeEvent: TerminalResizeEvent): boolean {
    if (!this.options.enableResizeHandling) {
      logger.debug(`Resize handling disabled, ignoring resize for session ${resizeEvent.sessionId}`);
      return false;
    }

    if (!this.isValidResizeEvent(resizeEvent)) {
      logger.warn(`Invalid resize event for session ${resizeEvent.sessionId}:`, resizeEvent);
      return false;
    }

    const { sessionId } = resizeEvent;

    // Clear any existing resize timer for this session
    const existingTimer = this.resizeTimers.get(sessionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Store the latest resize event
    this.lastResizeEvents.set(sessionId, resizeEvent);

    // Set up debounced resize handling
    const timer = setTimeout(() => {
      const latestEvent = this.lastResizeEvents.get(sessionId);
      if (latestEvent) {
        logger.debug(`Processing debounced resize for session ${sessionId}: ${latestEvent.cols}x${latestEvent.rows}`);
        this.emit('resize', latestEvent);
        this.lastResizeEvents.delete(sessionId);
      }
      this.resizeTimers.delete(sessionId);
    }, this.options.debounceResizeMs);

    this.resizeTimers.set(sessionId, timer);
    return true;
  }

  /**
   * Create a standardized control signal
   */
  createControlSignal(
    signal: TerminalControlSignal['signal'], 
    sessionId: string
  ): TerminalControlSignal {
    return {
      signal,
      sessionId,
      timestamp: Date.now()
    };
  }

  /**
   * Create a standardized resize event
   */
  createResizeEvent(
    sessionId: string,
    cols: number,
    rows: number
  ): TerminalResizeEvent {
    return {
      sessionId,
      cols: Math.max(this.options.minCols, Math.min(this.options.maxCols, cols)),
      rows: Math.max(this.options.minRows, Math.min(this.options.maxRows, rows)),
      timestamp: Date.now()
    };
  }

  /**
   * Get keyboard sequence for a signal (for terminal emulation)
   */
  getKeySequenceForSignal(signal: TerminalControlSignal['signal']): string | null {
    switch (signal) {
      case 'SIGINT':
        return '\x03'; // Ctrl-C
      case 'SIGTSTP':
        return '\x1a'; // Ctrl-Z
      case 'SIGQUIT':
        return '\x1c'; // Ctrl-\
      default:
        return null;
    }
  }

  /**
   * Clean up resources for a session
   */
  cleanupSession(sessionId: string): void {
    const timer = this.resizeTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.resizeTimers.delete(sessionId);
    }
    
    this.lastResizeEvents.delete(sessionId);
    logger.debug(`Cleaned up terminal control for session ${sessionId}`);
  }

  /**
   * Clean up all sessions
   */
  cleanupAll(): void {
    for (const timer of this.resizeTimers.values()) {
      clearTimeout(timer);
    }
    this.resizeTimers.clear();
    this.lastResizeEvents.clear();
    logger.debug('Cleaned up all terminal control sessions');
  }

  /**
   * Get statistics about active sessions
   */
  getStats(): {
    activeSessions: number;
    pendingResizes: number;
    totalSignalsProcessed: number;
    totalResizesProcessed: number;
  } {
    return {
      activeSessions: this.lastResizeEvents.size,
      pendingResizes: this.resizeTimers.size,
      totalSignalsProcessed: this.listenerCount('signal'),
      totalResizesProcessed: this.listenerCount('resize')
    };
  }

  private isValidSignal(signal: string): signal is TerminalControlSignal['signal'] {
    return ['SIGINT', 'SIGTERM', 'SIGKILL', 'SIGTSTP', 'SIGCONT', 'SIGQUIT'].includes(signal);
  }

  private isValidResizeEvent(resizeEvent: TerminalResizeEvent): boolean {
    const { cols, rows } = resizeEvent;
    return (
      Number.isInteger(cols) &&
      Number.isInteger(rows) &&
      cols >= this.options.minCols &&
      cols <= this.options.maxCols &&
      rows >= this.options.minRows &&
      rows <= this.options.maxRows
    );
  }
}
