/**
 * Request logging, error handling, and Vite dev proxy middleware
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

const serverLogger = logger.child('Server');

/**
 * Request logging middleware
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, url, ip } = req;
  
  // Log the request
  serverLogger.debug(`${method} ${url}`, {
    ip: ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent')
  });
  
  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any): any {
    const duration = Date.now() - start;
    const { statusCode } = res;
    
    // Determine log level based on status code
    const isError = statusCode >= 400;
    const logMethod = isError ? 'warn' : 'debug';
    
    serverLogger[logMethod](`${method} ${url} ${statusCode}`, {
      duration: `${duration}ms`,
      statusCode,
      contentLength: res.get('Content-Length')
    });
    
    // Call original end method
    return originalEnd.call(this, chunk, encoding);
  };
  
  next();
}

/**
 * CORS middleware for development
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Allow requests from Vite dev server
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  } else {
    next();
  }
}

/**
 * Health check endpoint
 */
export function healthCheck(req: Request, res: Response): void {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '0.1.0',
    service: 'amplify-backend'
  });
}

/**
 * Error handling middleware
 */
export function errorHandler(error: any, req: Request, res: Response, next: NextFunction): void {
  serverLogger.error('Request error', {
    method: req.method,
    url: req.url,
    error: error.message,
    stack: error.stack
  });
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  const message = isDevelopment ? error.message : 'Internal Server Error';
  const stack = isDevelopment ? error.stack : undefined;
  
  res.status(error.status || 500).json({
    error: {
      message,
      stack,
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * 404 handler for API routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  // Only handle API routes with 404, let SPA handler deal with others
  if (req.path.startsWith('/api')) {
    res.status(404).json({
      error: {
        message: 'API endpoint not found',
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
      }
    });
  } else {
    // Let this fall through to SPA handler
    res.status(404).send('Not Found');
  }
}

/**
 * Security headers middleware
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Basic security headers
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  
  // Don't set strict security headers in development for Vite HMR
  const isDevelopment = process.env.NODE_ENV === 'development';
  if (!isDevelopment) {
    res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  next();
}

/**
 * JSON body parser error handler
 */
export function jsonParseErrorHandler(error: any, req: Request, res: Response, next: NextFunction): void {
  if (error instanceof SyntaxError && 'body' in error) {
    serverLogger.warn('Invalid JSON in request body', {
      method: req.method,
      url: req.url,
      error: error.message
    });
    
    res.status(400).json({
      error: {
        message: 'Invalid JSON in request body',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
    return;
  }
  
  next(error);
}

/**
 * Rate limiting middleware (simple implementation)
 */
export function createRateLimiter(windowMs: number = 60000, maxRequests: number = 100) {
  const requests = new Map<string, { count: number; resetTime: number }>();
  
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean up old entries
    for (const [key, value] of requests.entries()) {
      if (value.resetTime < now) {
        requests.delete(key);
      }
    }
    
    // Get or create request info for this IP
    let requestInfo = requests.get(ip);
    if (!requestInfo || requestInfo.resetTime < now) {
      requestInfo = {
        count: 0,
        resetTime: now + windowMs
      };
      requests.set(ip, requestInfo);
    }
    
    requestInfo.count++;
    
    // Check if limit exceeded
    if (requestInfo.count > maxRequests) {
      serverLogger.warn('Rate limit exceeded', {
        ip,
        count: requestInfo.count,
        limit: maxRequests
      });
      
      res.status(429).json({
        error: {
          message: 'Too Many Requests',
          retryAfter: Math.ceil((requestInfo.resetTime - now) / 1000),
          timestamp: new Date().toISOString()
        }
      });
      return;
    }
    
    // Add rate limit headers
    res.header('X-RateLimit-Limit', maxRequests.toString());
    res.header('X-RateLimit-Remaining', (maxRequests - requestInfo.count).toString());
    res.header('X-RateLimit-Reset', new Date(requestInfo.resetTime).toISOString());
    
    next();
  };
}
