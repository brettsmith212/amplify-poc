/**
 * Authentication routes (/auth/github, /auth/callback)
 */

import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { 
  generateJWT, 
  setAuthCookie, 
  clearAuthCookie,
  initializeGitHubStrategy 
} from '../auth/github';
import { AuthenticatedUser } from '../models/User';
import { logger } from '../utils/logger';
import webConfig from '../config/webConfig';

const authLogger = logger.child('AuthRoutes');
const router = Router();

// Initialize GitHub strategy
initializeGitHubStrategy();

/**
 * GET /auth/github
 * Initiate GitHub OAuth flow
 */
router.get('/github', passport.authenticate('github', {
  scope: webConfig.github.scopes
}));

/**
 * GET /auth/callback
 * GitHub OAuth callback
 */
router.get('/callback', 
  passport.authenticate('github', { session: false }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as AuthenticatedUser;
      
      if (!user || !user.isAuthenticated) {
        authLogger.warn('Authentication callback failed - no user');
        return res.redirect(`${getFrontendUrl()}/login?error=auth_failed`);
      }

      // Generate JWT token
      const token = generateJWT(user);
      
      // Set secure HTTP-only cookie
      setAuthCookie(res, token);

      authLogger.info('User authenticated successfully', {
        id: user.id,
        username: user.username
      });

      // Redirect to frontend dashboard
      res.redirect(`${getFrontendUrl()}/sessions`);
      
    } catch (error) {
      authLogger.error('Authentication callback error:', error);
      res.redirect(`${getFrontendUrl()}/login?error=server_error`);
    }
  }
);

/**
 * POST /auth/logout
 * Logout user and clear authentication
 */
router.post('/logout', (req: Request, res: Response) => {
  const user = (req as any).user;
  
  if (user) {
    authLogger.info('User logged out', {
      id: user.id,
      username: user.username
    });
  }

  // Clear authentication cookie
  clearAuthCookie(res);
  
  res.json({ 
    success: true, 
    message: 'Logged out successfully' 
  });
});

/**
 * GET /auth/me
 * Get current authenticated user info
 */
router.get('/me', (req: Request, res: Response) => {
  const user = (req as any).user as AuthenticatedUser;
  
  if (!user || !user.isAuthenticated) {
    res.status(401).json({
      error: 'Not authenticated'
    });
    return;
  }

  // Return safe user info (no sensitive tokens)
  const safeUser = {
    id: user.id,
    githubId: user.githubId,
    username: user.username,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    scopes: user.scopes,
    profile: user.profile,
    preferences: user.preferences,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt
  };

  res.json({ user: safeUser });
});

/**
 * GET /auth/status
 * Check authentication status
 */
router.get('/status', (req: Request, res: Response) => {
  const user = (req as any).user;
  const isAuthenticated = user && user.isAuthenticated;

  res.json({
    isAuthenticated,
    user: isAuthenticated ? {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl
    } : null
  });
});

/**
 * PUT /auth/preferences
 * Update user preferences
 */
router.put('/preferences', (req: Request, res: Response) => {
  const user = (req as any).user as AuthenticatedUser;
  
  if (!user || !user.isAuthenticated) {
    res.status(401).json({
      error: 'Not authenticated'
    });
    return;
  }

  const { preferences } = req.body;
  
  if (!preferences) {
    res.status(400).json({
      error: 'Preferences are required'
    });
    return;
  }

  try {
    // In a real app, you'd update the database
    // For now, we'll just merge the preferences
    user.preferences = { ...user.preferences, ...preferences };

    authLogger.info('User preferences updated', {
      id: user.id,
      username: user.username
    });

    res.json({ 
      success: true, 
      preferences: user.preferences 
    });
  } catch (error) {
    authLogger.error('Failed to update preferences:', error);
    res.status(500).json({
      error: 'Failed to update preferences'
    });
  }
});

/**
 * Helper function to get frontend URL
 */
function getFrontendUrl(): string {
  if (webConfig.development.isDevelopment) {
    // In development, frontend runs on port 5173 (Vite dev server)
    return `http://${webConfig.server.host}:5173`;
  }
  return `https://${webConfig.server.host}`;
}

export default router;
