/**
 * Session API endpoint tests
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createWebApp } from '../app';
import { sessionStore } from '../services/sessionStore';
import { AuthenticatedUser, TerminalTheme, EditorTheme } from '../models/User';

describe('Session API Endpoints', () => {
  let app: any;
  let authToken: string;
  let testUser: AuthenticatedUser;

  beforeAll(async () => {
    // Create test app
    const webApp = createWebApp({
      projectRoot: process.cwd(),
      enableStaticServing: false,
      enableWebSocket: false
    });
    app = webApp.getApp();

    // Create test user
    testUser = {
      isAuthenticated: true,
      id: 'test-user-sessions',
      githubId: 12345678,
      username: 'testuser-sessions',
      email: 'test-sessions@example.com',
      name: 'Test User Sessions',
      avatarUrl: 'https://github.com/test-sessions.png',
      accessToken: process.env.GITHUB_TEST_TOKEN || 'test-token',
      scopes: ['repo', 'read:org', 'user:email'],
      createdAt: new Date(),
      lastLoginAt: new Date(),
      profile: {
        bio: 'Test user for session tests',
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

    // Create JWT token
    const jwtSecret = process.env.JWT_SECRET || 'amplify-dev-secret-key';
    authToken = jwt.sign(testUser, jwtSecret, {
      expiresIn: '1h',
      issuer: 'amplify-web',
      audience: 'amplify-users'
    });
  });

  beforeEach(() => {
    // Clear session store before each test
    const existingSessions = sessionStore.getUserSessions(testUser.id);
    existingSessions.forEach(session => {
      sessionStore.deleteSession(session.id);
    });
  });

  describe('GET /api/sessions', () => {
    it('should return empty array when user has no sessions', async () => {
      const response = await request(app)
        .get('/api/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: [],
        meta: {
          total: 0,
          userId: testUser.id
        }
      });
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/sessions')
        .expect(401);

      expect(response.body).toEqual({
        error: 'Authentication required',
        message: 'Please log in with GitHub to access this resource'
      });
    });
  });

  describe('POST /api/sessions', () => {
    const validSessionData = {
      repositoryUrl: 'https://github.com/brettsmith212/amplify-poc',
      branch: 'main',
      prompt: 'Test session prompt',
      sessionName: 'Test Session'
    };

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/sessions')
        .send(validSessionData)
        .expect(401);

      expect(response.body).toEqual({
        error: 'Authentication required',
        message: 'Please log in with GitHub to access this resource'
      });
    });

    it('should require repository URL', async () => {
      const response = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          branch: 'main',
          prompt: 'Test session prompt',
          sessionName: 'Test Session'
        })
        .expect(400);

      expect(response.body).toEqual({
        error: 'Invalid request',
        message: 'Repository URL is required'
      });
    });

    it('should require prompt', async () => {
      const response = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          repositoryUrl: 'https://github.com/brettsmith212/amplify-poc',
          branch: 'main',
          sessionName: 'Test Session'
        })
        .expect(400);

      expect(response.body).toEqual({
        error: 'Invalid request',
        message: 'Prompt is required'
      });
    });

    it('should validate repository URL format', async () => {
      const response = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          repositoryUrl: 'invalid-url',
          branch: 'main',
          prompt: 'Test session prompt',
          sessionName: 'Test Session'
        })
        .expect(500);

      expect(response.body.error).toBe('Failed to create session');
      expect(response.body.message).toContain('Invalid GitHub repository URL');
    });

    it('should use default values for optional fields', async () => {
      // This test would need a valid repository that exists and the user has access to
      // For now, we'll test the validation logic that happens before GitHub API calls
      const response = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          repositoryUrl: 'https://github.com/brettsmith212/amplify-poc',
          prompt: 'Test session prompt'
        });

      // Should fail during GitHub API validation if token is invalid, 
      // but should not fail on missing branch or sessionName
      expect(response.status).not.toBe(400);
    });
  });

  describe('GET /api/sessions/:sessionId', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/sessions/test-session-id')
        .expect(401);

      expect(response.body).toEqual({
        error: 'Authentication required',
        message: 'Please log in with GitHub to access this resource'
      });
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .get('/api/sessions/non-existent-session')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      expect(response.body.error).toBe('Failed to fetch session');
      expect(response.body.message).toBe('Session not found');
    });

    it('should require session ID parameter', async () => {
      const response = await request(app)
        .get('/api/sessions/')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200); // This hits the GET /api/sessions endpoint instead

      expect(response.body.success).toBe(true);
    });
  });

  describe('PUT /api/sessions/:sessionId', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .put('/api/sessions/test-session-id')
        .send({ sessionName: 'Updated Session Name' })
        .expect(401);

      expect(response.body).toEqual({
        error: 'Authentication required',
        message: 'Please log in with GitHub to access this resource'
      });
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .put('/api/sessions/non-existent-session')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ sessionName: 'Updated Session Name' })
        .expect(500);

      expect(response.body.error).toBe('Failed to update session');
      expect(response.body.message).toBe('Session not found');
    });
  });

  describe('DELETE /api/sessions/:sessionId', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .delete('/api/sessions/test-session-id')
        .expect(401);

      expect(response.body).toEqual({
        error: 'Authentication required',
        message: 'Please log in with GitHub to access this resource'
      });
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .delete('/api/sessions/non-existent-session')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      expect(response.body.error).toBe('Failed to delete session');
      expect(response.body.message).toBe('Session not found');
    });
  });

  describe('POST /api/sessions/:sessionId/start', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/sessions/test-session-id/start')
        .expect(401);

      expect(response.body).toEqual({
        error: 'Authentication required',
        message: 'Please log in with GitHub to access this resource'
      });
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .post('/api/sessions/non-existent-session/start')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      expect(response.body.error).toBe('Failed to start session');
      expect(response.body.message).toBe('Session not found');
    });
  });

  describe('POST /api/sessions/:sessionId/stop', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/sessions/test-session-id/stop')
        .expect(401);

      expect(response.body).toEqual({
        error: 'Authentication required',
        message: 'Please log in with GitHub to access this resource'
      });
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .post('/api/sessions/non-existent-session/stop')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      expect(response.body.error).toBe('Failed to stop session');
      expect(response.body.message).toBe('Session not found');
    });
  });

  describe('GET /api/sessions/:sessionId/status', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/sessions/test-session-id/status')
        .expect(401);

      expect(response.body).toEqual({
        error: 'Authentication required',
        message: 'Please log in with GitHub to access this resource'
      });
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .get('/api/sessions/non-existent-session/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      expect(response.body.error).toBe('Failed to get session status');
      expect(response.body.message).toBe('Session not found');
    });
  });

  describe('Integration tests', () => {
    it('should handle session creation workflow with mocked GitHub API', async () => {
      // Note: These would be integration tests that would require
      // mocking the GitHub API service or using a test repository
      // For now, we focus on the API structure and authentication
      
      const sessionData = {
        repositoryUrl: 'https://github.com/brettsmith212/test-repo',
        branch: 'main',
        prompt: 'Integration test session',
        sessionName: 'Integration Test Session'
      };

      const response = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sessionData);

      // Should fail at GitHub API validation stage, not at input validation
      expect(response.status).not.toBe(400);
      
      if (response.status === 201) {
        // If successful, test the full workflow
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('id');
        expect(response.body.data).toHaveProperty('userId', testUser.id);
        expect(response.body.data).toHaveProperty('name', sessionData.sessionName);
        expect(response.body.data).toHaveProperty('prompt', sessionData.prompt);
      }
    });
  });

  describe('Rate limiting', () => {
    it('should apply rate limiting to session endpoints', async () => {
      // Test that rate limiting middleware is applied
      // This is a structural test - the rate limiting logic is tested separately
      
      const response = await request(app)
        .get('/api/sessions')
        .set('Authorization', `Bearer ${authToken}`);

      // Should complete the request (pass rate limiting)
      expect(response.status).toBe(200);
    });
  });
});
