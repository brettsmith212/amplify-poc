import { existsSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export function validateGitRepository(workingDir: string = process.cwd()): ValidationResult {
  try {
    // Check if .git directory exists
    const gitDir = path.join(workingDir, '.git');
    if (!existsSync(gitDir)) {
      return {
        isValid: false,
        error: 'No git repository found. Please run this command from within a git repository.'
      };
    }

    // Verify git is working
    execSync('git status', { cwd: workingDir, stdio: 'ignore' });
    
    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: 'Invalid git repository or git is not available.'
    };
  }
}

export function validateEnvironment(): ValidationResult {
  // Check if required environment variables are set
  const requiredEnvVars = ['AMP_API_KEY'];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      return {
        isValid: false,
        error: `Required environment variable ${envVar} is not set. Please set it before running the command.`
      };
    }
  }

  return { isValid: true };
}

export function validateDockerAvailability(): ValidationResult {
  try {
    execSync('docker version', { stdio: 'ignore' });
    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: 'Docker is not available. Please ensure Docker is installed and running.'
    };
  }
}

export function validateAll(workingDir?: string): ValidationResult {
  const gitValidation = validateGitRepository(workingDir);
  if (!gitValidation.isValid) {
    return gitValidation;
  }

  const envValidation = validateEnvironment();
  if (!envValidation.isValid) {
    return envValidation;
  }

  const dockerValidation = validateDockerAvailability();
  if (!dockerValidation.isValid) {
    return dockerValidation;
  }

  return { isValid: true };
}
