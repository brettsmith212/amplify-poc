/**
 * SessionStore tests with focus on thread associations
 */

import { SessionStore } from '../../services/sessionStore';
import { Session, SessionStatus } from '../../models/Session';

describe('SessionStore - Thread Associations', () => {
  let store: SessionStore;
  let testSession: Session;

  beforeEach(() => {
    store = new SessionStore({
      defaultTTL: 60000, // 1 minute for tests
      maxSessions: 5,
      cleanupInterval: 30000 // 30 seconds
    });

    testSession = {
      id: 'test-session-1',
      userId: 'test-user-1',
      repositoryUrl: 'https://github.com/test/repo',
      repositoryName: 'test/repo',
      branch: 'main',
      status: SessionStatus.READY,
      threadId: 'thread_abc123',
      ampLogPath: '/tmp/amplify-data/test-session-1/amp.log',
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
      metadata: { tags: [] }
    };
  });

  afterEach(() => {
    store.destroy();
  });

  describe('Basic Session Operations', () => {
    it('should create session with thread data', () => {
      const result = store.createSession(testSession);
      
      expect(result).toBe(true);
      
      const retrievedSession = store.getSession(testSession.id);
      expect(retrievedSession).not.toBeNull();
      expect(retrievedSession?.threadId).toBe('thread_abc123');
      expect(retrievedSession?.ampLogPath).toBe('/tmp/amplify-data/test-session-1/amp.log');
    });

    it('should update session with thread data', () => {
      store.createSession(testSession);
      
      const updateResult = store.updateSession(testSession.id, {
        threadId: 'thread_xyz789',
        ampLogPath: '/tmp/amplify-data/test-session-1/amp-new.log'
      });
      
      expect(updateResult).toBe(true);
      
      const updatedSession = store.getSession(testSession.id);
      expect(updatedSession?.threadId).toBe('thread_xyz789');
      expect(updatedSession?.ampLogPath).toBe('/tmp/amplify-data/test-session-1/amp-new.log');
    });

    it('should preserve thread data during session lifecycle', () => {
      store.createSession(testSession);
      
      // Simulate starting container
      store.updateSession(testSession.id, {
        containerId: 'container_123',
        status: SessionStatus.RUNNING
      });
      
      // Simulate stopping container
      store.updateSession(testSession.id, {
        status: SessionStatus.STOPPED
      });
      
      const finalSession = store.getSession(testSession.id);
      expect(finalSession?.threadId).toBe('thread_abc123');
      expect(finalSession?.ampLogPath).toBe('/tmp/amplify-data/test-session-1/amp.log');
      expect(finalSession?.containerId).toBe('container_123');
    });
  });

  describe('Thread Association Methods', () => {
    beforeEach(() => {
      store.createSession(testSession);
    });

    it('should find session by thread ID', () => {
      const foundSession = store.getSessionByThreadId('thread_abc123');
      
      expect(foundSession).not.toBeNull();
      expect(foundSession?.id).toBe('test-session-1');
      expect(foundSession?.threadId).toBe('thread_abc123');
    });

    it('should return null for non-existent thread ID', () => {
      const foundSession = store.getSessionByThreadId('thread_nonexistent');
      
      expect(foundSession).toBeNull();
    });

    it('should get all sessions with threads', () => {
      // Create a session without thread
      const sessionWithoutThread: Session = {
        ...testSession,
        id: 'test-session-2'
      };
      delete (sessionWithoutThread as any).threadId;
      delete (sessionWithoutThread as any).ampLogPath;
      store.createSession(sessionWithoutThread);
      
      const sessionsWithThreads = store.getSessionsWithThreads();
      
      expect(sessionsWithThreads).toHaveLength(1);
      expect(sessionsWithThreads[0]?.id).toBe('test-session-1');
      expect(sessionsWithThreads[0]?.threadId).toBe('thread_abc123');
    });

    it('should update thread association', () => {
      const eventSpy = jest.fn();
      store.on('threadAssociationUpdated', eventSpy);
      
      const result = store.updateThreadAssociation(
        'test-session-1',
        'thread_new123',
        '/tmp/new-path/amp.log'
      );
      
      expect(result).toBe(true);
      expect(eventSpy).toHaveBeenCalledWith(
        'test-session-1',
        'thread_new123',
        '/tmp/new-path/amp.log'
      );
      
      const updatedSession = store.getSession('test-session-1');
      expect(updatedSession?.threadId).toBe('thread_new123');
      expect(updatedSession?.ampLogPath).toBe('/tmp/new-path/amp.log');
    });

    it('should fail to update thread association for non-existent session', () => {
      const result = store.updateThreadAssociation(
        'non-existent-session',
        'thread_123',
        '/tmp/path/amp.log'
      );
      
      expect(result).toBe(false);
    });

    it('should remove thread association', () => {
      const eventSpy = jest.fn();
      store.on('threadAssociationRemoved', eventSpy);
      
      const result = store.removeThreadAssociation('test-session-1');
      
      expect(result).toBe(true);
      expect(eventSpy).toHaveBeenCalledWith('test-session-1');
      
      const updatedSession = store.getSession('test-session-1');
      expect(updatedSession?.threadId).toBeUndefined();
      expect(updatedSession?.ampLogPath).toBeUndefined();
    });

    it('should fail to remove thread association for non-existent session', () => {
      const result = store.removeThreadAssociation('non-existent-session');
      
      expect(result).toBe(false);
    });
  });

  describe('Orphaned Thread Detection', () => {
    it('should identify orphaned threads (no container)', () => {
      // First ensure the testSession is created
      store.createSession(testSession);
      
      // Session with thread but no container
      const orphanedSession: Session = {
        ...testSession,
        id: 'orphaned-session',
        status: SessionStatus.READY
      };
      delete (orphanedSession as any).containerId;
      store.createSession(orphanedSession);
      
      // Session with thread and active container
      const activeSession: Session = {
        ...testSession,
        id: 'active-session',
        containerId: 'container_active',
        status: SessionStatus.RUNNING
      };
      store.createSession(activeSession);
      
      const orphanedSessions = store.findOrphanedThreadSessions();
      
      expect(orphanedSessions).toHaveLength(2); // testSession has no container + orphanedSession
      expect(orphanedSessions.map(s => s.id)).toContain('orphaned-session');
      expect(orphanedSessions.map(s => s.id)).toContain('test-session-1');
    });

    it('should identify orphaned threads (stopped container)', () => {
      // First ensure the testSession is created
      store.createSession(testSession);
      
      // Update test session to have stopped container
      store.updateSession(testSession.id, {
        containerId: 'container_stopped',
        status: SessionStatus.STOPPED
      });
      
      const orphanedSessions = store.findOrphanedThreadSessions();
      
      expect(orphanedSessions).toHaveLength(1);
      expect(orphanedSessions[0]?.id).toBe('test-session-1');
    });

    it('should not identify running sessions as orphaned', () => {
      // First ensure the testSession is created
      store.createSession(testSession);
      
      store.updateSession(testSession.id, {
        containerId: 'container_running',
        status: SessionStatus.RUNNING
      });
      
      const orphanedSessions = store.findOrphanedThreadSessions();
      
      expect(orphanedSessions).toHaveLength(0);
    });
  });

  describe('Thread Association Statistics', () => {
    beforeEach(() => {
      // First ensure the original testSession is created
      store.createSession(testSession);
      
      // Create multiple sessions with different thread states
      const sessions: Session[] = [
        {
          ...testSession,
          id: 'session-with-active-thread',
          threadId: 'thread_active',
          ampLogPath: '/tmp/active/amp.log',
          containerId: 'container_active',
          status: SessionStatus.RUNNING
        },
        {
          ...testSession,
          id: 'session-with-orphaned-thread',
          threadId: 'thread_orphaned',
          ampLogPath: '/tmp/orphaned/amp.log',
          status: SessionStatus.READY
        },
        {
          ...testSession,
          id: 'session-without-thread',
          containerId: 'container_no_thread',
          status: SessionStatus.RUNNING
        }
      ];
      
      // Clean up optional fields for sessions without thread/container
      delete (sessions[1] as any).containerId;
      delete (sessions[2] as any).threadId;
      delete (sessions[2] as any).ampLogPath;
      
      sessions.forEach(session => store.createSession(session));
    });

    it('should calculate thread association statistics', () => {
      const stats = store.getThreadAssociationStats();
      
      expect(stats.totalSessions).toBe(4); // 3 new + 1 from beforeEach
      expect(stats.sessionsWithThreads).toBe(3); // 2 new + 1 from beforeEach (session-without-thread doesn't have threads)
      expect(stats.orphanedThreads).toBe(2); // orphaned + original testSession (no container)
      expect(stats.activeThreads).toBe(3); // all 3 sessions with threads are READY or RUNNING
    });

    it('should handle empty store statistics', () => {
      store.destroy();
      store = new SessionStore();
      
      const stats = store.getThreadAssociationStats();
      
      expect(stats.totalSessions).toBe(0);
      expect(stats.sessionsWithThreads).toBe(0);
      expect(stats.orphanedThreads).toBe(0);
      expect(stats.activeThreads).toBe(0);
    });
  });

  describe('Thread Persistence Across Session Lifecycle', () => {
    it('should maintain thread associations during container restarts', () => {
      store.createSession(testSession);
      
      // Start container
      store.updateSession(testSession.id, {
        containerId: 'container_1',
        status: SessionStatus.RUNNING
      });
      
      // Stop container
      store.updateSession(testSession.id, {
        status: SessionStatus.STOPPED
      });
      
      // Start new container
      store.updateSession(testSession.id, {
        containerId: 'container_2',
        status: SessionStatus.RUNNING
      });
      
      const finalSession = store.getSession(testSession.id);
      expect(finalSession?.threadId).toBe('thread_abc123');
      expect(finalSession?.ampLogPath).toBe('/tmp/amplify-data/test-session-1/amp.log');
      expect(finalSession?.containerId).toBe('container_2');
      expect(finalSession?.status).toBe(SessionStatus.RUNNING);
    });

    it('should preserve thread data when touching session', () => {
      store.createSession(testSession);
      
      const originalTimestamp = testSession.lastAccessedAt.getTime();
      
      const touchResult = store.touchSession(testSession.id);
      expect(touchResult).toBe(true);
      
      const touchedSession = store.getSession(testSession.id);
      expect(touchedSession?.threadId).toBe('thread_abc123');
      expect(touchedSession?.ampLogPath).toBe('/tmp/amplify-data/test-session-1/amp.log');
      expect(touchedSession?.lastAccessedAt.getTime()).toBeGreaterThanOrEqual(originalTimestamp);
    });
  });

  describe('Event Emissions', () => {
    beforeEach(() => {
      store.createSession(testSession);
    });

    it('should emit threadAssociationUpdated event', () => {
      const eventSpy = jest.fn();
      store.on('threadAssociationUpdated', eventSpy);
      
      store.updateThreadAssociation('test-session-1', 'new_thread', '/new/path');
      
      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(eventSpy).toHaveBeenCalledWith('test-session-1', 'new_thread', '/new/path');
    });

    it('should emit threadAssociationRemoved event', () => {
      const eventSpy = jest.fn();
      store.on('threadAssociationRemoved', eventSpy);
      
      store.removeThreadAssociation('test-session-1');
      
      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(eventSpy).toHaveBeenCalledWith('test-session-1');
    });
  });

  describe('Edge Cases', () => {
    it('should handle sessions with partial thread data', () => {
      const partialSession: Session = {
        ...testSession,
        id: 'partial-session',
        threadId: 'thread_partial'
      };
      delete (partialSession as any).ampLogPath; // Missing amp log path
      
      store.createSession(partialSession);
      
      const sessionsWithThreads = store.getSessionsWithThreads();
      expect(sessionsWithThreads).not.toContain(partialSession);
      
      const foundByThreadId = store.getSessionByThreadId('thread_partial');
      expect(foundByThreadId?.id).toBe('partial-session');
    });

    it('should handle duplicate thread IDs gracefully', () => {
      store.createSession(testSession);
      
      const duplicateSession: Session = {
        ...testSession,
        id: 'duplicate-session',
        userId: 'different-user',
        threadId: 'thread_abc123' // Same thread ID
      };
      
      store.createSession(duplicateSession);
      
      // Should return the first session found
      const foundSession = store.getSessionByThreadId('thread_abc123');
      expect(foundSession?.id).toBe('test-session-1');
    });
  });
});
