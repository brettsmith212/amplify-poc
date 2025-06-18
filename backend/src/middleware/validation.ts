import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const validationErrors: ValidationError[] = errors.array().map((error: any) => ({
      field: error.type === 'field' ? error.path : 'unknown',
      message: error.msg,
      value: error.type === 'field' ? error.value : undefined,
    }));

    res.status(400).json({
      error: 'Validation failed',
      message: 'Please check your input and try again',
      details: validationErrors,
    });
    return;
  }

  next();
};

// Session validation rules
export const validateCreateSession = [
  body('repositoryUrl')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Repository URL is required')
    .isURL({ protocols: ['https'] })
    .withMessage('Repository URL must be a valid HTTPS URL')
    .contains('github.com')
    .withMessage('Repository URL must be a GitHub repository'),
  
  body('branch')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Branch name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Branch name must be between 1 and 100 characters'),
  
  body('sessionName')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Session name must be between 1 and 200 characters'),
  
  handleValidationErrors,
];

export const validateSessionId = [
  param('sessionId')
    .isUUID()
    .withMessage('Session ID must be a valid UUID'),
  
  handleValidationErrors,
];

// Git operation validation rules
export const validateCommitMessage = [
  body('message')
    .isString()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Commit message must be between 1 and 500 characters'),
  
  handleValidationErrors,
];

// GitHub API validation rules
export const validateRepoParams = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Page must be between 1 and 100'),
  
  query('per_page')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Per page must be between 1 and 100'),
  
  handleValidationErrors,
];

export const validateBranchParams = [
  param('owner')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Owner must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9._-]+$/)
    .withMessage('Owner contains invalid characters'),
  
  param('repo')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Repository name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9._-]+$/)
    .withMessage('Repository name contains invalid characters'),
  
  handleValidationErrors,
];

// Generic validation helpers
export const validateRequired = (fields: string[]) => {
  return fields.map(field => 
    body(field)
      .exists()
      .withMessage(`${field} is required`)
      .notEmpty()
      .withMessage(`${field} cannot be empty`)
  );
};

export const validateOptional = (field: string, validator: any) => {
  return body(field).optional().custom(validator);
};

// Rate limiting validation
export const validateRateLimit = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const clientId = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 100; // 100 requests per minute

  // In a real application, you'd use Redis or a proper rate limiting solution
  // This is a simple in-memory implementation for demonstration
  if (!(global as any).rateLimitStore) {
    (global as any).rateLimitStore = new Map();
  }

  const store = (global as any).rateLimitStore as Map<string, { count: number; resetTime: number }>;
  const key = `${clientId}:${Math.floor(now / windowMs)}`;
  
  const current = store.get(key) || { count: 0, resetTime: now + windowMs };
  
  if (current.count >= maxRequests) {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil((current.resetTime - now) / 1000),
    });
    return;
  }

  current.count++;
  store.set(key, current);

  // Clean up old entries
  const cutoff = now - windowMs;
  for (const [key, value] of store.entries()) {
    if (value.resetTime < cutoff) {
      store.delete(key);
    }
  }

  next();
};

// Error handling middleware
export const handleServerError = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Server error:', err);

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
    ...(isDevelopment && { details: err.message, stack: err.stack }),
  });
};

export default {
  handleValidationErrors,
  validateCreateSession,
  validateSessionId,
  validateCommitMessage,
  validateRepoParams,
  validateBranchParams,
  validateRequired,
  validateOptional,
  validateRateLimit,
  handleServerError,
};
