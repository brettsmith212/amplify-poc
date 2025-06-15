/**
 * Authentication middleware for protected routes
 */

import { Request, Response, NextFunction } from 'express';
import { 
  extractTokenFromRequest, 
  verifyJWT, 
  clearAuthCookie 
} from '../auth/github';
import { AuthenticatedUser } from '../models/User';
import { logger } from '../utils/logger';

const authLogger = logger.child('AuthMiddleware');

/**
 * Middleware to authenticate user from JWT token
 */
export function authenticateUser(req: Request, res: Response, next: NextFunction): void {
  const token = extractTokenFromRequest(req);

  if (!token) {
    authLogger.debug('No authentication token found');
    return next(); // Continue without authentication
  }

  const verification = verifyJWT(token);

  if (!verification.valid) {
    authLogger.warn('Invalid authentication token', { error: verification.error });
    
    // Clear invalid cookie
    clearAuthCookie(res);
    return next(); // Continue without authentication
  }

  // Create authenticated user object from JWT payload
  const payload = verification.payload;
  const user: AuthenticatedUser = {
    isAuthenticated: true,
    id: payload.id,
    githubId: payload.githubId,
    username: payload.username,
    email: payload.email,
    name: payload.name || '',
    avatarUrl: payload.avatarUrl || '',
    accessToken: '', // Not stored in JWT for security
    scopes: payload.scopes || [],
    createdAt: new Date(payload.iat * 1000),
    lastLoginAt: new Date(),
    profile: payload.profile || {
      bio: '',
      company: '',
      location: '',
      blog: '',
      twitterUsername: '',
      publicRepos: 0,
      privateRepos: 0,
      followers: 0,
      following: 0
    },
    preferences: payload.preferences || {
      terminalTheme: 'dark',
      editorTheme: 'vs-dark',
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

  // Attach user to request
  (req as any).user = user;

  authLogger.debug('User authenticated from token', {
    id: user.id,
    username: user.username
  });

  next();
}

/**
 * Middleware to require authentication
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user as AuthenticatedUser;

  if (!user || !user.isAuthenticated) {
    authLogger.warn('Access denied - authentication required', {
      path: req.path,
      method: req.method,
      ip: req.ip
    });

    res.status(401).json({
      error: 'Authentication required',
      message: 'Please log in with GitHub to access this resource'
    });
    return;
  }

  authLogger.debug('Access granted', {
    userId: user.id,
    username: user.username,
    path: req.path
  });

  next();
}

/**
 * Middleware to require specific GitHub scopes
 */
export function requireScopes(requiredScopes: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user as AuthenticatedUser;

    if (!user || !user.isAuthenticated) {
      res.status(401).json({
        error: 'Authentication required'
      });
      return;
    }

    const userScopes = user.scopes || [];
    const hasRequiredScopes = requiredScopes.every(scope => userScopes.includes(scope));

    if (!hasRequiredScopes) {
      const missingScopes = requiredScopes.filter(scope => !userScopes.includes(scope));
      
      authLogger.warn('Access denied - insufficient scopes', {
        userId: user.id,
        requiredScopes,
        userScopes,
        missingScopes
      });

      res.status(403).json({
        error: 'Insufficient permissions',
        message: `Missing required GitHub scopes: ${missingScopes.join(', ')}`,
        requiredScopes,
        missingScopes
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to optionally authenticate user (continues even if not authenticated)
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  authenticateUser(req, res, next);
}

/**
 * Helper function to check if user is authenticated
 */
export function isUserAuthenticated(req: Request): boolean {
  const user = (req as any).user as AuthenticatedUser;
  return user && user.isAuthenticated;
}

/**
 * Helper function to get authenticated user from request
 */
export function getAuthenticatedUser(req: Request): AuthenticatedUser | null {
  const user = (req as any).user as AuthenticatedUser;
  return (user && user.isAuthenticated) ? user : null;
}

/**
 * Middleware to log authentication events
 */
export function logAuthEvents(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user as AuthenticatedUser;
  
  if (user && user.isAuthenticated) {
    authLogger.debug('Authenticated request', {
      userId: user.id,
      username: user.username,
      method: req.method,
      path: req.path,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });
  } else {
    authLogger.debug('Unauthenticated request', {
      method: req.method,
      path: req.path,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });
  }

  next();
}
