/**
 * Session controller tests with thread bootstrap functionality
 */

import { AuthenticatedUser, TerminalTheme, EditorTheme } from '../../models/User';
import { Session, SessionStatus } from '../../models/Session';
import { sessionStore } from '../../services/sessionStore';
import { ampService } from '../../services/ampService';
import * as sessionController from '../../controllers/sessionController';

// Mock GitHub API service
jest.mock('../../services/githubApi', () => ({
  createGitHubApiService: jest.fn(() => ({
    validateRepositoryAccess: jest.fn().mockResolvedValue({ success: true }),
    getBranches: jest.fn().mockResolvedValue({
      success: true,
      data: [{ name: 'main' }, { name: 'develop' }]
    })
  }))
}));

// Mock amp service
jest.mock('../../services/ampService', () => ({
  ampService: {
    createThread: jest.fn(),
    continueThread: jest.fn(),
    getAmpLogPath: jest.fn(),
    checkAmpAvailability: jest.fn().mockResolvedValue(true)
  }
}));

// Mock session store
jest.mock('../../services/sessionStore', () => ({
  sessionStore: {
    getUserSessions: jest.fn(),
    getSession: jest.fn(),
    createSession: jest.fn(),
    updateSession: jest.fn(),
    deleteSession: jest.fn()
  }
}));

const mockAmpService = ampService as jest.Mocked<typeof ampService>;
const mockSessionStore = sessionStore as jest.Mocked<typeof sessionStore>;

describe('SessionController - Thread Bootstrap', () => {
  let testUser: AuthenticatedUser;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    testUser = {
      isAuthenticated: true,
      id: 'test-user-thread',
      githubId: 12345,
      username: 'testuser',
      email: 'test@example.com',
      name: 'Test User',
      avatarUrl: 'https://github.com/test.png',
      accessToken: 'test-token',
      scopes: ['repo'],
      createdAt: new Date(),
      lastLoginAt: new Date(),
      profile: {
        bio: 'Test user',
        company: 'Test Company',
        location: 'Test Location',
        blog: 'https://test-blog.com',
        twitterUsername: 'testuser',
        publicRepos: 10,
        privateRepos: 5,
        followers: 100,
        following: 50
      },
      preferences: {
        terminalTheme: TerminalTheme.DARK,
        editorTheme: EditorTheme.VS_DARK,
        sessionTimeout: 240,
        autoSaveInterval: 30,
        notifications: {
          sessionExpiry: true,
          containerErrors: true,
          gitOperations: true,
          email: false
        }
      }
    };

    // Default mock responses
    mockSessionStore.getUserSessions.mockReturnValue([]);
    mockSessionStore.getSession.mockReturnValue(null);
    mockAmpService.createThread.mockResolvedValue({
      success: true,
      threadId: 'thread_abc123',
      ampLogPath: '/tmp/amplify-data/session-123/amp.log'
    });
  });

  describe('createSession', () => {
    const validSessionData = {
      repositoryUrl: 'https://github.com/test/repo',
      branch: 'main',
      sessionName: 'Test Session'
    };

    it('should create amp thread during session creation', async () => {
      const result = await sessionController.createSession(testUser, validSessionData);

      expect(mockAmpService.createThread).toHaveBeenCalledWith(
        expect.stringMatching(/^session-\d+-[a-z0-9]+$/),
        {
          environment: {
            REPOSITORY_URL: validSessionData.repositoryUrl,
            REPOSITORY_BRANCH: validSessionData.branch,
            USER_ID: testUser.id
          }
        }
      );

      expect(result.success).toBe(true);
    });

    it('should store thread ID and amp log path in session', async () => {
      let capturedSession: Session | undefined;
      
      mockSessionStore.createSession.mockImplementation((session: Session) => {
        capturedSession = session;
        return true;
      });

      const result = await sessionController.createSession(testUser, validSessionData);

      expect(result.success).toBe(true);
      expect(mockSessionStore.createSession).toHaveBeenCalled();
      expect(capturedSession!.threadId).toBe('thread_abc123');
      expect(capturedSession!.ampLogPath).toBe('/tmp/amplify-data/session-123/amp.log');
    });

    it('should fail session creation if thread creation fails', async () => {
      mockAmpService.createThread.mockResolvedValue({
        success: false,
        error: 'Failed to create thread'
      });

      const result = await sessionController.createSession(testUser, validSessionData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to create thread');
      expect(mockSessionStore.createSession).not.toHaveBeenCalled();
    });

    it('should pass correct environment variables to amp thread creation', async () => {
      await sessionController.createSession(testUser, validSessionData);

      expect(mockAmpService.createThread).toHaveBeenCalledWith(
        expect.any(String),
        {
          environment: {
            REPOSITORY_URL: 'https://github.com/test/repo',
            REPOSITORY_BRANCH: 'main',
            USER_ID: 'test-user-thread'
          }
        }
      );
    });

    it('should create session with READY status after successful thread creation', async () => {
      let capturedSession: Session | undefined;
      
      mockSessionStore.createSession.mockImplementation((session: Session) => {
        capturedSession = session;
        return true;
      });

      const result = await sessionController.createSession(testUser, validSessionData);

      expect(result.success).toBe(true);
      expect(capturedSession!.status).toBe(SessionStatus.READY);
    });

    it('should handle thread creation timeout gracefully', async () => {
      mockAmpService.createThread.mockResolvedValue({
        success: false,
        error: 'Command timeout after 30000ms'
      });

      const result = await sessionController.createSession(testUser, validSessionData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Command timeout');
    });

    it('should generate unique session IDs for concurrent requests', async () => {
      const calls: string[] = [];
      mockAmpService.createThread.mockImplementation(async (sessionId: string) => {
        calls.push(sessionId);
        return {
          success: true,
          threadId: `thread_${sessionId.slice(-6)}`,
          ampLogPath: `/tmp/amplify-data/${sessionId}/amp.log`
        };
      });

      // Create multiple sessions concurrently
      const promises = [
        sessionController.createSession(testUser, validSessionData),
        sessionController.createSession(testUser, validSessionData),
        sessionController.createSession(testUser, validSessionData)
      ];

      await Promise.all(promises);

      // All session IDs should be unique
      expect(new Set(calls).size).toBe(3);
    });
  });

  describe('Thread Bootstrap Integration', () => {
    it('should maintain thread data throughout session lifecycle', async () => {
      const sessionData = {
        repositoryUrl: 'https://github.com/test/repo',
        branch: 'main',
        sessionName: 'Integration Test'
      };

      // Create session
      const createResult = await sessionController.createSession(testUser, sessionData);
      expect(createResult.success).toBe(true);

      // Mock session store to return the created session
      const mockSession: Session = {
        id: 'test-session-id',
        userId: testUser.id,
        repositoryUrl: sessionData.repositoryUrl,
        repositoryName: 'test/repo',
        branch: sessionData.branch,
        status: SessionStatus.READY,
        threadId: 'thread_abc123',
        ampLogPath: '/tmp/amplify-data/test-session-id/amp.log',
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        expiresAt: new Date(Date.now() + 14400000),
        metadata: { tags: [] }
      };

      mockSessionStore.getSession.mockReturnValue(mockSession);

      // Get session
      const getResult = await sessionController.getSessionById(testUser.id, 'test-session-id');
      expect(getResult.success).toBe(true);
      expect(getResult.data?.threadId).toBe('thread_abc123');
      expect(getResult.data?.ampLogPath).toBe('/tmp/amplify-data/test-session-id/amp.log');
    });

    it('should handle missing thread data gracefully', async () => {
      const sessionWithoutThread: Session = {
        id: 'session-no-thread',
        userId: testUser.id,
        repositoryUrl: 'https://github.com/test/repo',
        repositoryName: 'test/repo',
        branch: 'main',
        status: SessionStatus.READY,
        // threadId and ampLogPath are undefined
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        expiresAt: new Date(Date.now() + 14400000),
        metadata: { tags: [] }
      };

      mockSessionStore.getSession.mockReturnValue(sessionWithoutThread);

      const result = await sessionController.getSessionById(testUser.id, 'session-no-thread');
      expect(result.success).toBe(true);
      expect(result.data?.threadId).toBeUndefined();
      expect(result.data?.ampLogPath).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    const sessionData = {
      repositoryUrl: 'https://github.com/test/repo',
      branch: 'main',
      sessionName: 'Error Test'
    };

    it('should handle amp service unavailable', async () => {
      mockAmpService.createThread.mockRejectedValue(new Error('amp command not found'));

      const result = await sessionController.createSession(testUser, sessionData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('amp command not found');
    });

    it('should handle thread ID parsing failures', async () => {
      mockAmpService.createThread.mockResolvedValue({
        success: false,
        error: 'Failed to parse thread ID from amp command output'
      });

      const result = await sessionController.createSession(testUser, sessionData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to parse thread ID');
    });

    it('should handle amp log file creation failures', async () => {
      mockAmpService.createThread.mockResolvedValue({
        success: false,
        error: 'Permission denied writing to amp.log'
      });

      const result = await sessionController.createSession(testUser, sessionData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });
  });
});
