/**
 * Environment variable validation and management
 */

import { logger } from '../utils/logger';

export interface EnvironmentConfig {
  ampApiKey?: string | undefined;
  workspaceDir: string;
  sessionId: string;
}

export interface EnvironmentValidationResult {
  isValid: boolean;
  config?: EnvironmentConfig;
  errors: string[];
  warnings: string[];
}

/**
 * Validate and extract environment configuration
 */
export function validateEnvironment(workspaceDir: string, sessionId: string): EnvironmentValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check for AMP_API_KEY
  const ampApiKey = process.env.AMP_API_KEY;
  if (!ampApiKey) {
    warnings.push('AMP_API_KEY environment variable not set - amp CLI will require authentication in container');
  }
  
  // Validate workspace directory
  if (!workspaceDir) {
    errors.push('Workspace directory not provided');
  }
  
  // Validate session ID
  if (!sessionId) {
    errors.push('Session ID not provided');
  }
  
  // Check if we're in a git repository
  try {
    const fs = require('fs');
    const path = require('path');
    const gitDir = path.join(workspaceDir, '.git');
    if (!fs.existsSync(gitDir)) {
      warnings.push('Current directory is not a git repository - some amp features may not work optimally');
    }
  } catch (error) {
    logger.debug('Error checking git repository', error);
  }
  
  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
      warnings
    };
  }
  
  const config: EnvironmentConfig = {
    ampApiKey,
    workspaceDir,
    sessionId
  };
  
  return {
    isValid: true,
    config,
    errors,
    warnings
  };
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `amplify-${timestamp}-${random}`;
}

/**
 * Get container environment variables
 */
export function getContainerEnvironment(config: EnvironmentConfig): Record<string, string> {
  const env: Record<string, string> = {};
  
  // Add AMP_API_KEY if available
  if (config.ampApiKey) {
    env.AMP_API_KEY = config.ampApiKey;
  }
  
  // Add other useful environment variables
  env.AMPLIFY_SESSION_ID = config.sessionId;
  env.AMPLIFY_WORKSPACE = '/workspace';
  
  return env;
}

/**
 * Log environment status
 */
export function logEnvironmentStatus(result: EnvironmentValidationResult): void {
  if (result.isValid && result.config) {
    logger.info('Environment validation passed', {
      sessionId: result.config.sessionId,
      hasApiKey: !!result.config.ampApiKey,
      workspaceDir: result.config.workspaceDir
    });
  } else {
    logger.error('Environment validation failed', {
      errors: result.errors
    });
  }
  
  // Log warnings
  for (const warning of result.warnings) {
    logger.warn(warning);
  }
}
