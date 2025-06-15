/**
 * Rate limiting middleware for GitHub API endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

const rateLimitLogger = logger.child('RateLimit');

interface RateLimit {
  windowStart: number;
  count: number;
}

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  message?: string;
}

class RateLimiter {
  private limits: Map<string, RateLimit> = new Map();
  private options: RateLimitOptions;

  constructor(options: RateLimitOptions) {
    this.options = {
      keyGenerator: (req) => req.ip || 'unknown',
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      message: 'Too many requests, please try again later.',
      ...options
    };
  }

  middleware = (req: Request, res: Response, next: NextFunction): void => {
    const key = this.options.keyGenerator!(req);
    const now = Date.now();
    const windowStart = now - (now % this.options.windowMs);

    let limit = this.limits.get(key);
    
    if (!limit || limit.windowStart !== windowStart) {
      limit = {
        windowStart,
        count: 0
      };
      this.limits.set(key, limit);
    }

    // Clean up old entries periodically
    if (Math.random() < 0.01) { // 1% chance
      this.cleanup();
    }

    if (limit.count >= this.options.maxRequests) {
      const resetTime = new Date(windowStart + this.options.windowMs);
      
      rateLimitLogger.warn('Rate limit exceeded', {
        key,
        count: limit.count,
        limit: this.options.maxRequests,
        resetTime,
        userAgent: req.get('User-Agent'),
        path: req.path
      });

      res.set({
        'X-RateLimit-Limit': this.options.maxRequests.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': Math.ceil(resetTime.getTime() / 1000).toString(),
        'Retry-After': Math.ceil((resetTime.getTime() - now) / 1000).toString()
      });

      res.status(429).json({
        error: 'Too Many Requests',
        message: this.options.message,
        retryAfter: Math.ceil((resetTime.getTime() - now) / 1000)
      });
      return;
    }

    // Track the request
    const originalSend = res.send;
    const rateLimiter = this;
    res.send = function(body: any) {
      const statusCode = res.statusCode;
      const shouldSkip = 
        (statusCode < 400 && rateLimiter.options.skipSuccessfulRequests) ||
        (statusCode >= 400 && rateLimiter.options.skipFailedRequests);

      if (!shouldSkip) {
        limit!.count++;
      }

      return originalSend.call(this, body);
    };

    const remaining = Math.max(0, this.options.maxRequests - limit.count - 1);
    const resetTime = windowStart + this.options.windowMs;

    res.set({
      'X-RateLimit-Limit': this.options.maxRequests.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': Math.ceil(resetTime / 1000).toString()
    });

    next();
  };

  private cleanup() {
    const now = Date.now();
    const cutoff = now - this.options.windowMs * 2; // Keep some history

    for (const [key, limit] of this.limits.entries()) {
      if (limit.windowStart < cutoff) {
        this.limits.delete(key);
      }
    }

    rateLimitLogger.debug('Cleaned up rate limit entries', {
      remaining: this.limits.size
    });
  }

  /**
   * Get current rate limit status for a key
   */
  getStatus(key: string): {
    limit: number;
    remaining: number;
    resetTime: Date;
  } {
    const now = Date.now();
    const windowStart = now - (now % this.options.windowMs);
    const limit = this.limits.get(key);

    if (!limit || limit.windowStart !== windowStart) {
      return {
        limit: this.options.maxRequests,
        remaining: this.options.maxRequests,
        resetTime: new Date(windowStart + this.options.windowMs)
      };
    }

    return {
      limit: this.options.maxRequests,
      remaining: Math.max(0, this.options.maxRequests - limit.count),
      resetTime: new Date(limit.windowStart + this.options.windowMs)
    };
  }
}

/**
 * GitHub API rate limiter - 60 requests per minute per user
 */
export const githubApiRateLimit = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // GitHub allows 5000/hour, we'll be conservative
  keyGenerator: (req) => {
    // Rate limit per authenticated user
    const user = (req as any).user;
    return user ? `github:${user.id}` : `ip:${req.ip}`;
  },
  skipSuccessfulRequests: false,
  skipFailedRequests: true, // Don't count errors against rate limit
  message: 'GitHub API rate limit exceeded. Please try again in a minute.'
});

/**
 * General API rate limiter - 100 requests per minute per IP
 */
export const generalRateLimit = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  keyGenerator: (req) => req.ip || 'unknown',
  message: 'Too many requests from this IP. Please try again later.'
});

/**
 * Authentication rate limiter - 10 requests per minute per IP
 */
export const authRateLimit = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  keyGenerator: (req) => req.ip || 'unknown',
  message: 'Too many authentication attempts. Please try again later.'
});
