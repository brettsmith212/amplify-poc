/**
 * In-memory session storage with TTL management
 */

import { EventEmitter } from 'events';
import { Session, SessionStatus, SessionSummary, SessionConnection, SessionStats } from '../models/Session';
import { logger } from '../utils/logger';

const storeLogger = logger.child('SessionStore');

export interface SessionStoreConfig {
  defaultTTL: number; // Default TTL in milliseconds
  maxSessions: number; // Maximum sessions per user
  cleanupInterval: number; // Cleanup interval in milliseconds
}

export class SessionStore extends EventEmitter {
  private sessions: Map<string, Session> = new Map();
  private userSessions: Map<string, Set<string>> = new Map();
  private connections: Map<string, SessionConnection[]> = new Map();
  private cleanupTimer?: NodeJS.Timeout | undefined;
  private config: SessionStoreConfig;

  constructor(config: Partial<SessionStoreConfig> = {}) {
    super();
    this.config = {
      defaultTTL: config.defaultTTL || 4 * 60 * 60 * 1000, // 4 hours
      maxSessions: config.maxSessions || 10,
      cleanupInterval: config.cleanupInterval || 5 * 60 * 1000, // 5 minutes
      ...config
    };

    this.startCleanupTimer();
    storeLogger.info('SessionStore initialized', this.config);
  }

  /**
   * Create a new session
   */
  createSession(session: Session): boolean {
    // Check if user has reached max sessions
    const userSessionIds = this.userSessions.get(session.userId) || new Set();
    if (userSessionIds.size >= this.config.maxSessions) {
      storeLogger.warn(`User ${session.userId} has reached maximum sessions (${this.config.maxSessions})`);
      return false;
    }

    // Store the session
    this.sessions.set(session.id, session);
    
    // Update user sessions index
    if (!this.userSessions.has(session.userId)) {
      this.userSessions.set(session.userId, new Set());
    }
    this.userSessions.get(session.userId)!.add(session.id);

    // Initialize connections array
    this.connections.set(session.id, []);

    storeLogger.info(`Session created: ${session.id}`, {
      userId: session.userId,
      repository: session.repositoryName,
      branch: session.branch
    });

    this.emit('sessionCreated', session);
    return true;
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): Session | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get all sessions for a user
   */
  getUserSessions(userId: string): SessionSummary[] {
    const sessionIds = this.userSessions.get(userId) || new Set();
    const sessions: SessionSummary[] = [];

    for (const sessionId of sessionIds) {
      const session = this.sessions.get(sessionId);
      if (session) {
        const connections = this.connections.get(sessionId) || [];
        sessions.push({
          id: session.id,
          repositoryName: session.repositoryName,
          branch: session.branch,
          status: session.status,
          createdAt: session.createdAt,
          lastAccessedAt: session.lastAccessedAt,
          expiresAt: session.expiresAt,
          connectionCount: connections.filter(c => c.isActive).length
        });
      }
    }

    return sessions.sort((a, b) => b.lastAccessedAt.getTime() - a.lastAccessedAt.getTime());
  }

  /**
   * Update a session
   */
  updateSession(sessionId: string, updates: Partial<Session>): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    const updatedSession = { ...session, ...updates };
    this.sessions.set(sessionId, updatedSession);

    storeLogger.debug(`Session updated: ${sessionId}`, updates);
    this.emit('sessionUpdated', updatedSession, updates);
    return true;
  }

  /**
   * Touch a session to update its last accessed time and extend TTL
   */
  touchSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    const now = new Date();
    const updatedSession = {
      ...session,
      lastAccessedAt: now,
      expiresAt: new Date(now.getTime() + this.config.defaultTTL)
    };

    this.sessions.set(sessionId, updatedSession);
    return true;
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Remove from sessions
    this.sessions.delete(sessionId);

    // Remove from user sessions index
    const userSessionIds = this.userSessions.get(session.userId);
    if (userSessionIds) {
      userSessionIds.delete(sessionId);
      if (userSessionIds.size === 0) {
        this.userSessions.delete(session.userId);
      }
    }

    // Remove connections
    this.connections.delete(sessionId);

    storeLogger.info(`Session deleted: ${sessionId}`, {
      userId: session.userId,
      repository: session.repositoryName
    });

    this.emit('sessionDeleted', session);
    return true;
  }

  /**
   * Add a connection to a session
   */
  addConnection(sessionId: string, connectionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    const connections = this.connections.get(sessionId) || [];
    const connection: SessionConnection = {
      sessionId,
      connectionId,
      connectedAt: new Date(),
      lastActivityAt: new Date(),
      isActive: true
    };

    connections.push(connection);
    this.connections.set(sessionId, connections);

    // Touch the session to extend its TTL
    this.touchSession(sessionId);

    storeLogger.debug(`Connection added to session: ${sessionId}`, { connectionId });
    this.emit('connectionAdded', sessionId, connection);
    return true;
  }

  /**
   * Remove a connection from a session
   */
  removeConnection(sessionId: string, connectionId: string): boolean {
    const connections = this.connections.get(sessionId);
    if (!connections) {
      return false;
    }

    const connectionIndex = connections.findIndex(c => c.connectionId === connectionId);
    if (connectionIndex === -1) {
      return false;
    }

    const connection = connections[connectionIndex];
    if (connection) {
      connection.isActive = false;
      connection.lastActivityAt = new Date();
    }

    storeLogger.debug(`Connection removed from session: ${sessionId}`, { connectionId });
    this.emit('connectionRemoved', sessionId, connectionId);
    return true;
  }

  /**
   * Get active connections for a session
   */
  getActiveConnections(sessionId: string): SessionConnection[] {
    const connections = this.connections.get(sessionId) || [];
    return connections.filter(c => c.isActive);
  }

  /**
   * Get sessions by thread ID
   */
  getSessionByThreadId(threadId: string): Session | null {
    for (const session of this.sessions.values()) {
      if (session.threadId === threadId) {
        return session;
      }
    }
    return null;
  }

  /**
   * Get all sessions with active threads
   */
  getSessionsWithThreads(): Session[] {
    return Array.from(this.sessions.values()).filter(session => 
      session.threadId && session.ampLogPath
    );
  }

  /**
   * Update thread association for a session
   */
  updateThreadAssociation(sessionId: string, threadId: string, ampLogPath: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      storeLogger.warn(`Cannot update thread association: session ${sessionId} not found`);
      return false;
    }

    const updatedSession = {
      ...session,
      threadId,
      ampLogPath,
      lastAccessedAt: new Date()
    };

    this.sessions.set(sessionId, updatedSession);
    
    storeLogger.info(`Thread association updated for session: ${sessionId}`, {
      threadId,
      ampLogPath
    });

    this.emit('threadAssociationUpdated', sessionId, threadId, ampLogPath);
    return true;
  }

  /**
   * Remove thread association from a session
   */
  removeThreadAssociation(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    const updatedSession = {
      ...session,
      lastAccessedAt: new Date()
    };

    // Remove thread-related properties
    delete (updatedSession as any).threadId;
    delete (updatedSession as any).ampLogPath;

    this.sessions.set(sessionId, updatedSession);
    
    storeLogger.info(`Thread association removed from session: ${sessionId}`);
    this.emit('threadAssociationRemoved', sessionId);
    return true;
  }

  /**
   * Find sessions with orphaned threads (no active container)
   */
  findOrphanedThreadSessions(): Session[] {
    return Array.from(this.sessions.values()).filter(session => 
      session.threadId && 
      session.ampLogPath && 
      (!session.containerId || session.status === SessionStatus.STOPPED)
    );
  }

  /**
   * Get thread associations summary
   */
  getThreadAssociationStats(): {
    totalSessions: number;
    sessionsWithThreads: number;
    orphanedThreads: number;
    activeThreads: number;
  } {
    const allSessions = Array.from(this.sessions.values());
    const sessionsWithThreads = allSessions.filter(s => s.threadId && s.ampLogPath);
    const orphanedThreads = this.findOrphanedThreadSessions();
    const activeThreads = sessionsWithThreads.filter(s => 
      s.status === SessionStatus.RUNNING || s.status === SessionStatus.READY
    );

    return {
      totalSessions: allSessions.length,
      sessionsWithThreads: sessionsWithThreads.length,
      orphanedThreads: orphanedThreads.length,
      activeThreads: activeThreads.length
    };
  }

  /**
   * Get session statistics
   */
  getStats(): SessionStats {
    const allSessions = Array.from(this.sessions.values());
    const activeSessions = allSessions.filter(s => 
      s.status === SessionStatus.READY || 
      s.status === SessionStatus.RUNNING
    );

    let totalConnections = 0;
    let activeConnections = 0;

    for (const connections of this.connections.values()) {
      totalConnections += connections.length;
      activeConnections += connections.filter(c => c.isActive).length;
    }

    const dates = allSessions.map(s => s.createdAt);
    const oldestSession = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : undefined;
    const newestSession = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : undefined;

    return {
      totalSessions: this.sessions.size,
      activeSessions: activeSessions.length,
      userSessions: this.userSessions.size,
      oldestSession,
      newestSession,
      totalConnections,
      activeConnections
    };
  }

  /**
   * Find sessions that have expired
   */
  findExpiredSessions(): Session[] {
    const now = new Date();
    const expiredSessions: Session[] = [];

    for (const session of this.sessions.values()) {
      if (session.expiresAt < now) {
        expiredSessions.push(session);
      }
    }

    return expiredSessions;
  }

  /**
   * Start the automatic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);

    storeLogger.info(`Cleanup timer started with interval: ${this.config.cleanupInterval}ms`);
  }

  /**
   * Perform cleanup of expired sessions and inactive connections
   */
  private cleanup(): void {
    const expiredSessions = this.findExpiredSessions();
    
    if (expiredSessions.length > 0) {
      storeLogger.info(`Cleaning up ${expiredSessions.length} expired sessions`);
      
      for (const session of expiredSessions) {
        this.emit('sessionExpired', session);
        this.deleteSession(session.id);
      }
    }

    // Clean up old inactive connections (keep last 100 per session)
    for (const [sessionId, connections] of this.connections.entries()) {
      const inactiveConnections = connections.filter(c => !c.isActive);
      if (inactiveConnections.length > 100) {
        const toRemove = inactiveConnections
          .sort((a, b) => a.lastActivityAt.getTime() - b.lastActivityAt.getTime())
          .slice(0, inactiveConnections.length - 100);
        
        const updatedConnections = connections.filter(c => 
          c.isActive || !toRemove.some(r => r.connectionId === c.connectionId)
        );
        
        this.connections.set(sessionId, updatedConnections);
      }
    }
  }

  /**
   * Stop the cleanup timer and clean up resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    this.sessions.clear();
    this.userSessions.clear();
    this.connections.clear();
    this.removeAllListeners();

    storeLogger.info('SessionStore destroyed');
  }
}

// Singleton instance
export const sessionStore = new SessionStore();
