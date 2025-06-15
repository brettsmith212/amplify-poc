/**
 * Web service configuration for Phase 2
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config();

export interface WebConfig {
  server: {
    port: number;
    host: string;
    corsOrigins: string[];
    trustProxy: boolean;
  };
  
  session: {
    defaultTTL: number; // Session TTL in milliseconds
    maxSessionsPerUser: number;
    cleanupInterval: number; // Cleanup interval in milliseconds
  };
  
  container: {
    baseImage: string;
    networkName: string;
    resourceLimits: {
      memory: string;
      cpus: string;
    };
    gracefulShutdownTimeout: number;
  };
  
  github: {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
    scopes: string[];
  };
  
  security: {
    jwtSecret: string;
    cookieSecret: string;
    cookieMaxAge: number; // Cookie max age in milliseconds
    rateLimiting: {
      windowMs: number;
      maxRequests: number;
    };
  };
  
  development: {
    isDevelopment: boolean;
    enableDebugLogs: boolean;
    hotReload: boolean;
  };
}

const webConfig: WebConfig = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || 'localhost',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    trustProxy: process.env.TRUST_PROXY === 'true'
  },
  
  session: {
    defaultTTL: parseInt(process.env.SESSION_TTL || '14400000', 10), // 4 hours
    maxSessionsPerUser: parseInt(process.env.MAX_SESSIONS_PER_USER || '10', 10),
    cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL || '300000', 10) // 5 minutes
  },
  
  container: {
    baseImage: process.env.DOCKER_BASE_IMAGE || 'amplify-base:latest',
    networkName: process.env.DOCKER_NETWORK || 'amplify-network',
    resourceLimits: {
      memory: process.env.CONTAINER_MEMORY_LIMIT || '2g',
      cpus: process.env.CONTAINER_CPU_LIMIT || '1.0'
    },
    gracefulShutdownTimeout: parseInt(process.env.CONTAINER_SHUTDOWN_TIMEOUT || '30000', 10)
  },
  
  github: {
    clientId: process.env.GITHUB_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    callbackUrl: process.env.GITHUB_CALLBACK_URL || 'http://localhost:3000/auth/callback',
    scopes: ['repo', 'read:org', 'user:email']
  },
  
  security: {
    jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret-change-this',
    cookieSecret: process.env.COOKIE_SECRET || 'your-cookie-secret-change-this',
    cookieMaxAge: parseInt(process.env.COOKIE_MAX_AGE || '604800000', 10), // 7 days
    rateLimiting: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10), // 1 minute
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100', 10)
    }
  },
  
  development: {
    isDevelopment: process.env.NODE_ENV !== 'production',
    enableDebugLogs: process.env.DEBUG_LOGS === 'true',
    hotReload: process.env.HOT_RELOAD !== 'false'
  }
};

/**
 * Validate required configuration values
 */
export function validateConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check required GitHub OAuth settings
  if (!webConfig.github.clientId) {
    errors.push('GITHUB_CLIENT_ID is required');
  }
  
  if (!webConfig.github.clientSecret) {
    errors.push('GITHUB_CLIENT_SECRET is required');
  }
  
  // Check security settings in production
  if (!webConfig.development.isDevelopment) {
    if (webConfig.security.jwtSecret === 'your-jwt-secret-change-this') {
      errors.push('JWT_SECRET must be set in production');
    }
    
    if (webConfig.security.cookieSecret === 'your-cookie-secret-change-this') {
      errors.push('COOKIE_SECRET must be set in production');
    }
  }
  
  // Validate port range
  if (webConfig.server.port < 1 || webConfig.server.port > 65535) {
    errors.push('PORT must be between 1 and 65535');
  }
  
  // Validate session settings
  if (webConfig.session.defaultTTL < 60000) { // Min 1 minute
    errors.push('SESSION_TTL must be at least 60000ms (1 minute)');
  }
  
  if (webConfig.session.maxSessionsPerUser < 1) {
    errors.push('MAX_SESSIONS_PER_USER must be at least 1');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get environment-specific configuration
 */
export function getEnvironmentConfig(): {
  name: string;
  config: WebConfig;
  validation: { isValid: boolean; errors: string[] };
} {
  const validation = validateConfig();
  
  return {
    name: webConfig.development.isDevelopment ? 'development' : 'production',
    config: webConfig,
    validation
  };
}

export default webConfig;
