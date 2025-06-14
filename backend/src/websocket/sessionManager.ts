import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { generateSessionId } from '../config/environment';

export interface TerminalSessionInfo {
  id: string;
  createdAt: Date;
  lastActivity: Date;
  isActive: boolean;
  clientInfo?: {
    userAgent?: string;
    remoteAddress?: string;
  };
  terminalInfo?: {
    cols: number;
    rows: number;
    lastResize: Date;
  };
  shellInfo?: {
    shellSessionId?: string;
    workingDirectory?: string;
    environment?: Record<string, string>;
  };
  stats: {
    messagesReceived: number;
    messagesSent: number;
    bytesReceived: number;
    bytesSent: number;
    resizeEvents: number;
    controlSignals: number;
  };
}

export interface SessionManagerOptions {
  maxIdleTimeMs?: number;
  cleanupIntervalMs?: number;
  maxSessions?: number;
  enableStats?: boolean;
}

export class TerminalSessionManager extends EventEmitter {
  private sessions: Map<string, TerminalSessionInfo> = new Map();
  private options: Required<SessionManagerOptions>;
  private cleanupTimer?: NodeJS.Timeout | undefined;

  constructor(options: SessionManagerOptions = {}) {
    super();
    
    this.options = {
      maxIdleTimeMs: options.maxIdleTimeMs ?? 30 * 60 * 1000, // 30 minutes
      cleanupIntervalMs: options.cleanupIntervalMs ?? 5 * 60 * 1000, // 5 minutes
      maxSessions: options.maxSessions ?? 100,
      enableStats: options.enableStats ?? true
    };

    this.startCleanupTimer();
    logger.info('Terminal session manager initialized', this.options);
  }

  /**
   * Create a new terminal session
   */
  createSession(clientInfo?: TerminalSessionInfo['clientInfo']): TerminalSessionInfo {
    if (this.sessions.size >= this.options.maxSessions) {
      throw new Error(`Maximum session limit reached: ${this.options.maxSessions}`);
    }

    const sessionId = generateSessionId();
    const now = new Date();
    
    const session: TerminalSessionInfo = {
      id: sessionId,
      createdAt: now,
      lastActivity: now,
      isActive: true,
      ...(clientInfo && { clientInfo }),
      stats: {
        messagesReceived: 0,
        messagesSent: 0,
        bytesReceived: 0,
        bytesSent: 0,
        resizeEvents: 0,
        controlSignals: 0
      }
    };

    this.sessions.set(sessionId, session);
    this.emit('sessionCreated', session);
    
    logger.info(`Created terminal session ${sessionId}`, {
      totalSessions: this.sessions.size,
      clientInfo
    });

    return session;
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): TerminalSessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Update session activity
   */
  updateActivity(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.lastActivity = new Date();
    return true;
  }

  /**
   * Update terminal dimensions
   */
  updateTerminalInfo(sessionId: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.terminalInfo = {
      cols,
      rows,
      lastResize: new Date()
    };

    if (this.options.enableStats) {
      session.stats.resizeEvents++;
    }

    this.updateActivity(sessionId);
    this.emit('terminalResized', sessionId, cols, rows);
    
    logger.debug(`Updated terminal info for session ${sessionId}: ${cols}x${rows}`);
    return true;
  }

  /**
   * Update shell session info
   */
  updateShellInfo(
    sessionId: string, 
    shellSessionId: string, 
    workingDirectory?: string, 
    environment?: Record<string, string>
  ): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.shellInfo = {
      shellSessionId,
      ...(workingDirectory && { workingDirectory }),
      ...(environment && { environment })
    };

    this.updateActivity(sessionId);
    this.emit('shellUpdated', sessionId, shellSessionId);
    
    logger.debug(`Updated shell info for session ${sessionId}: ${shellSessionId}`);
    return true;
  }

  /**
   * Record message statistics
   */
  recordMessage(sessionId: string, direction: 'sent' | 'received', bytes: number): boolean {
    if (!this.options.enableStats) {
      return true;
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    if (direction === 'sent') {
      session.stats.messagesSent++;
      session.stats.bytesSent += bytes;
    } else {
      session.stats.messagesReceived++;
      session.stats.bytesReceived += bytes;
    }

    this.updateActivity(sessionId);
    return true;
  }

  /**
   * Record control signal
   */
  recordControlSignal(sessionId: string, signal: string): boolean {
    if (!this.options.enableStats) {
      return true;
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.stats.controlSignals++;
    this.updateActivity(sessionId);
    this.emit('controlSignal', sessionId, signal);
    
    logger.debug(`Recorded control signal ${signal} for session ${sessionId}`);
    return true;
  }

  /**
   * Mark session as inactive
   */
  deactivateSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.isActive = false;
    this.updateActivity(sessionId);
    this.emit('sessionDeactivated', sessionId);
    
    logger.info(`Deactivated session ${sessionId}`);
    return true;
  }

  /**
   * Remove a session completely
   */
  removeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    this.sessions.delete(sessionId);
    this.emit('sessionRemoved', sessionId, session);
    
    logger.info(`Removed session ${sessionId}`, {
      duration: Date.now() - session.createdAt.getTime(),
      stats: session.stats
    });

    return true;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): TerminalSessionInfo[] {
    return Array.from(this.sessions.values()).filter(session => session.isActive);
  }

  /**
   * Get all sessions (active and inactive)
   */
  getAllSessions(): TerminalSessionInfo[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get session statistics
   */
  getStats(): {
    totalSessions: number;
    activeSessions: number;
    inactiveSessions: number;
    oldestSession?: Date;
    newestSession?: Date;
    totalMessages: number;
    totalBytes: number;
  } {
    const sessions = this.getAllSessions();
    const activeSessions = sessions.filter(s => s.isActive);
    
    const totalMessages = sessions.reduce((sum, s) => 
      sum + s.stats.messagesReceived + s.stats.messagesSent, 0);
    const totalBytes = sessions.reduce((sum, s) => 
      sum + s.stats.bytesReceived + s.stats.bytesSent, 0);

    const result = {
      totalSessions: sessions.length,
      activeSessions: activeSessions.length,
      inactiveSessions: sessions.length - activeSessions.length,
      totalMessages,
      totalBytes
    } as {
      totalSessions: number;
      activeSessions: number;
      inactiveSessions: number;
      oldestSession?: Date;
      newestSession?: Date;
      totalMessages: number;
      totalBytes: number;
    };

    if (sessions.length > 0) {
      result.oldestSession = new Date(Math.min(...sessions.map(s => s.createdAt.getTime())));
      result.newestSession = new Date(Math.max(...sessions.map(s => s.createdAt.getTime())));
    }

    return result;
  }

  /**
   * Clean up idle sessions
   */
  cleanupIdleSessions(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      const idleTime = now - session.lastActivity.getTime();
      
      if (idleTime > this.options.maxIdleTimeMs) {
        logger.info(`Cleaning up idle session ${sessionId}`, {
          idleTimeMs: idleTime,
          maxIdleTimeMs: this.options.maxIdleTimeMs
        });
        
        this.removeSession(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.emit('sessionsCleanedUp', cleaned);
      logger.info(`Cleaned up ${cleaned} idle sessions`);
    }

    return cleaned;
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupIdleSessions();
    }, this.options.cleanupIntervalMs);

    logger.debug(`Started session cleanup timer: ${this.options.cleanupIntervalMs}ms interval`);
  }

  /**
   * Stop cleanup timer and clean up all sessions
   */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    const sessionCount = this.sessions.size;
    this.sessions.clear();
    this.emit('shutdown', sessionCount);
    
    logger.info(`Session manager shutdown, removed ${sessionCount} sessions`);
  }

  /**
   * Check if session limit is reached
   */
  isSessionLimitReached(): boolean {
    return this.sessions.size >= this.options.maxSessions;
  }

  /**
   * Get session uptime in milliseconds
   */
  getSessionUptime(sessionId: string): number | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    return Date.now() - session.createdAt.getTime();
  }

  /**
   * Get session idle time in milliseconds
   */
  getSessionIdleTime(sessionId: string): number | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    return Date.now() - session.lastActivity.getTime();
  }
}
