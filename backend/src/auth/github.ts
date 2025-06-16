/**
 * GitHub OAuth strategy and token handling
 */

import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import jwt from 'jsonwebtoken';
import { Request, Response } from 'express';

import webConfig from '../config/webConfig';
import { User, AuthenticatedUser, TerminalTheme, EditorTheme } from '../models/User';
import { logger } from '../utils/logger';

const authLogger = logger.child('GitHubAuth');

export interface GitHubProfile {
  id: string;
  username: string;
  displayName: string;
  emails?: Array<{ value: string; verified: boolean; primary: boolean }>;
  photos?: Array<{ value: string }>;
  profileUrl: string;
  _raw: string;
  _json: any;
}

export interface GitHubAuthResult {
  success: boolean;
  user?: AuthenticatedUser;
  token?: string;
  error?: string;
}

/**
 * Initialize GitHub OAuth strategy
 */
export function initializeGitHubStrategy(): void {
  passport.use(new GitHubStrategy({
    clientID: webConfig.github.clientId,
    clientSecret: webConfig.github.clientSecret,
    callbackURL: webConfig.github.callbackUrl,
    scope: webConfig.github.scopes
  },
  async (accessToken: string, refreshToken: string, profile: GitHubProfile, done: any) => {
    try {
      authLogger.info('GitHub OAuth callback received', {
        userId: profile.id,
        username: profile.username
      });

      // Create user object from GitHub profile
      const user = await createUserFromGitHubProfile(profile, accessToken, refreshToken);
      
      authLogger.info('User authenticated successfully', {
        id: user.id,
        username: user.username
      });

      return done(null, user);
    } catch (error) {
      authLogger.error('GitHub OAuth error:', error);
      return done(error, null);
    }
  }));

  // Serialize user for session
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id: string, done) => {
    try {
      // In a real app, you'd fetch from database
      // For now, we'll just pass through the user
      done(null, { id });
    } catch (error) {
      done(error, null);
    }
  });

  authLogger.info('GitHub OAuth strategy initialized', {
    clientId: webConfig.github.clientId,
    callbackUrl: webConfig.github.callbackUrl,
    scopes: webConfig.github.scopes
  });
}

/**
 * Create a User object from GitHub profile
 */
async function createUserFromGitHubProfile(
  profile: GitHubProfile, 
  accessToken: string, 
  refreshToken?: string
): Promise<AuthenticatedUser> {
  const primaryEmail = profile.emails?.find(email => email.primary)?.value || '';
  const avatarUrl = profile.photos?.[0]?.value || '';

  const user: AuthenticatedUser = {
    isAuthenticated: true,
    id: `github_${profile.id}`,
    githubId: parseInt(profile.id, 10),
    username: profile.username,
    email: primaryEmail,
    name: profile.displayName,
    avatarUrl,
    accessToken,
    refreshToken,
    scopes: webConfig.github.scopes,
    createdAt: new Date(),
    lastLoginAt: new Date(),
    profile: {
      bio: profile._json.bio || '',
      company: profile._json.company || '',
      location: profile._json.location || '',
      blog: profile._json.blog || '',
      twitterUsername: profile._json.twitter_username || '',
      publicRepos: profile._json.public_repos || 0,
      privateRepos: profile._json.total_private_repos || 0,
      followers: profile._json.followers || 0,
      following: profile._json.following || 0
    },
    preferences: {
      terminalTheme: TerminalTheme.DARK,
      editorTheme: EditorTheme.VS_DARK,
      sessionTimeout: 240, // 4 hours in minutes
      autoSaveInterval: 30,
      notifications: {
        sessionExpiry: true,
        containerErrors: true,
        gitOperations: true,
        email: false
      }
    }
  };

  return user;
}

/**
 * Generate JWT token for authenticated user
 */
export function generateJWT(user: AuthenticatedUser): string {
  const payload = {
    id: user.id,
    githubId: user.githubId,
    username: user.username,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    accessToken: user.accessToken,
    scopes: user.scopes,
    profile: user.profile,
    preferences: user.preferences,
    iat: Math.floor(Date.now() / 1000)
  };

  return jwt.sign(payload, webConfig.security.jwtSecret, {
    expiresIn: '7d',
    issuer: 'amplify-web',
    audience: 'amplify-users'
  });
}

/**
 * Verify and decode JWT token
 */
export function verifyJWT(token: string): { valid: boolean; payload?: any; error?: string } {
  try {
    const payload = jwt.verify(token, webConfig.security.jwtSecret, {
      issuer: 'amplify-web',
      audience: 'amplify-users'
    });

    return { valid: true, payload };
  } catch (error: any) {
    authLogger.warn('JWT verification failed:', error.message);
    return { valid: false, error: error.message };
  }
}

/**
 * Set authentication cookie
 */
export function setAuthCookie(res: Response, token: string): void {
  res.cookie('amplify_auth', token, {
    httpOnly: true,
    secure: !webConfig.development.isDevelopment,
    sameSite: 'lax',
    maxAge: webConfig.security.cookieMaxAge,
    path: '/'
  });

  authLogger.debug('Authentication cookie set');
}

/**
 * Clear authentication cookie
 */
export function clearAuthCookie(res: Response): void {
  res.clearCookie('amplify_auth', {
    httpOnly: true,
    secure: !webConfig.development.isDevelopment,
    sameSite: 'lax',
    path: '/'
  });

  authLogger.debug('Authentication cookie cleared');
}

/**
 * Extract token from request (cookie or Authorization header)
 */
export function extractTokenFromRequest(req: Request): string | null {
  // Check for cookie first
  const cookieToken = req.cookies?.amplify_auth;
  if (cookieToken) {
    return cookieToken;
  }

  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

/**
 * Get user from request (after authentication middleware)
 */
export function getUserFromRequest(req: Request): AuthenticatedUser | null {
  return (req as any).user || null;
}

/**
 * Check if request is authenticated
 */
export function isAuthenticated(req: Request): boolean {
  const user = getUserFromRequest(req);
  return user !== null && user.isAuthenticated;
}
