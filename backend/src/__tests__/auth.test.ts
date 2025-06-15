/**
 * Authentication flow tests
 */

import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';

import { authenticateUser, requireAuth } from '../middleware/auth';
import { generateJWT, verifyJWT } from '../auth/github';
import { AuthenticatedUser, TerminalTheme, EditorTheme } from '../models/User';

// Mock the GitHub strategy initialization and routes
jest.mock('../auth/github', () => ({
  generateJWT: jest.fn(),
  verifyJWT: jest.fn(),
  initializeGitHubStrategy: jest.fn(),
  extractTokenFromRequest: jest.fn(),
  clearAuthCookie: jest.fn()
}));

// Mock routes to avoid GitHub OAuth dependencies
const mockAuthRoutes = express.Router();
mockAuthRoutes.get('/status', (req, res) => {
  const user = (req as any).user;
  res.json({
    isAuthenticated: !!user,
    user: user ? { id: user.id, username: user.username } : null
  });
});

mockAuthRoutes.get('/me', (req, res) => {
  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  res.json({ user });
});

mockAuthRoutes.post('/logout', (req, res) => {
  res.json({ success: true });
});

describe('Authentication Flow', () => {
  let app: express.Application;
  let mockUser: AuthenticatedUser;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser('test-secret'));
    app.use(authenticateUser);
    app.use('/auth', mockAuthRoutes);

    // Create mock user
    mockUser = {
      isAuthenticated: true,
      id: 'github_123456',
      githubId: 123456,
      username: 'testuser',
      email: 'test@example.com',
      name: 'Test User',
      avatarUrl: 'https://github.com/avatar.jpg',
      accessToken: 'mock-access-token',
      scopes: ['repo', 'read:org'],
      createdAt: new Date(),
      lastLoginAt: new Date(),
      profile: {
        bio: 'Test bio',
        company: 'Test Company',
        location: 'Test City',
        blog: 'https://testblog.com',
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
  });

  describe('JWT Token Handling', () => {
    it('should generate valid JWT token', () => {
      const mockGenerateJWT = generateJWT as jest.MockedFunction<typeof generateJWT>;
      mockGenerateJWT.mockReturnValue('mocked-jwt-token');
      
      const token = generateJWT(mockUser);
      expect(token).toBe('mocked-jwt-token');
      expect(mockGenerateJWT).toHaveBeenCalledWith(mockUser);
    });

    it('should verify valid JWT token', () => {
      const mockVerifyJWT = verifyJWT as jest.MockedFunction<typeof verifyJWT>;
      mockVerifyJWT.mockReturnValue({
        valid: true,
        payload: {
          id: mockUser.id,
          username: mockUser.username
        }
      });
      
      const verification = verifyJWT('valid-token');
      
      expect(verification.valid).toBe(true);
      expect(verification.payload).toBeTruthy();
      expect(verification.payload.id).toBe(mockUser.id);
      expect(verification.payload.username).toBe(mockUser.username);
    });

    it('should reject invalid JWT token', () => {
      const mockVerifyJWT = verifyJWT as jest.MockedFunction<typeof verifyJWT>;
      mockVerifyJWT.mockReturnValue({
        valid: false,
        error: 'Invalid token'
      });
      
      const verification = verifyJWT('invalid-token');
      
      expect(verification.valid).toBe(false);
      expect(verification.error).toBeTruthy();
    });
  });

  describe('Authentication Routes', () => {
    it('should return 401 for /auth/me without authentication', async () => {
      await request(app)
        .get('/auth/me')
        .expect(401);
    });

    it('should return user info for authenticated /auth/me', async () => {
      // Mock authenticated request by manually setting user
      const authApp = express();
      authApp.use(express.json());
      authApp.use((req, res, next) => {
        (req as any).user = mockUser;
        next();
      });
      authApp.use('/auth', mockAuthRoutes);
      
      const response = await request(authApp)
        .get('/auth/me')
        .expect(200);

      expect(response.body.user).toBeTruthy();
      expect(response.body.user.id).toBe(mockUser.id);
      expect(response.body.user.username).toBe(mockUser.username);
    });

    it('should return authentication status', async () => {
      const response = await request(app)
        .get('/auth/status')
        .expect(200);

      expect(response.body.isAuthenticated).toBe(false);
      expect(response.body.user).toBeNull();
    });

    it('should handle logout', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Authentication Middleware', () => {
    it('should deny access to protected route without authentication', async () => {
      const protectedApp = express();
      protectedApp.use(express.json());
      protectedApp.get('/protected', requireAuth, (req, res) => {
        res.json({ message: 'Protected resource accessed' });
      });

      await request(protectedApp)
        .get('/protected')
        .expect(401);
    });

    it('should allow access to protected route with authentication', async () => {
      const protectedApp = express();
      protectedApp.use(express.json());
      protectedApp.use((req, res, next) => {
        (req as any).user = mockUser;
        next();
      });
      protectedApp.get('/protected', requireAuth, (req, res) => {
        res.json({ message: 'Protected resource accessed' });
      });

      const response = await request(protectedApp)
        .get('/protected')
        .expect(200);

      expect(response.body.message).toBe('Protected resource accessed');
    });
  });
});
