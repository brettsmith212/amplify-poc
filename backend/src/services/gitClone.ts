/**
 * Git repository cloning service
 */

import { execSync, spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

const gitCloneLogger = logger.child('GitCloneService');

export interface GitCloneResult {
  success: boolean;
  error?: string;
  clonedPath?: string;
  branch?: string;
}

export interface GitCloneOptions {
  depth?: number;
  timeout?: number;
  gitCredentials?: {
    username: string;
    token: string;
  };
}

/**
 * Clone a Git repository to a specified directory
 */
export async function cloneRepository(
  repositoryUrl: string,
  branch: string = 'main',
  targetDirectory: string,
  options: GitCloneOptions = {}
): Promise<GitCloneResult> {
  try {
    gitCloneLogger.info('Starting repository clone', {
      repositoryUrl,
      branch,
      targetDirectory
    });

    // Validate inputs
    if (!repositoryUrl || !targetDirectory) {
      return {
        success: false,
        error: 'Repository URL and target directory are required'
      };
    }

    // Sanitize repository URL and extract info
    const urlMatch = repositoryUrl.match(/^https:\/\/github\.com\/([\w-]+)\/([\w.-]+?)(?:\.git)?(?:\/)?$/);
    if (!urlMatch) {
      return {
        success: false,
        error: 'Invalid GitHub repository URL format'
      };
    }

    const [, owner, repo] = urlMatch;
    const sanitizedUrl = `https://github.com/${owner}/${repo}.git`;

    // Ensure target directory parent exists
    const parentDir = path.dirname(targetDirectory);
    await fs.mkdir(parentDir, { recursive: true });

    // Check if target directory already exists and is not empty
    try {
      const stats = await fs.stat(targetDirectory);
      if (stats.isDirectory()) {
        const files = await fs.readdir(targetDirectory);
        if (files.length > 0) {
          gitCloneLogger.info('Target directory already exists and is not empty, skipping clone', {
            repositoryUrl,
            targetDirectory,
            existingFiles: files.length
          });

          return {
            success: true,
            clonedPath: targetDirectory,
            branch
          };
        }
      }
    } catch (statError) {
      // Directory doesn't exist, which is fine
    }

    // Prepare git clone command
    const cloneArgs = [
      'clone',
      '--depth', (options.depth || 1).toString(),
      '--branch', branch,
      '--single-branch',
      sanitizedUrl,
      targetDirectory
    ];

    gitCloneLogger.debug('Executing git clone', {
      command: 'git',
      args: cloneArgs,
      timeout: options.timeout || 60000
    });

    // Execute git clone
    await executeGitCommand('git', cloneArgs, options.timeout || 60000);

    // Verify clone was successful
    const gitDir = path.join(targetDirectory, '.git');
    try {
      await fs.access(gitDir);
    } catch (accessError) {
      return {
        success: false,
        error: 'Repository clone failed - no .git directory found'
      };
    }

    // Get actual current branch (in case the specified branch didn't exist and git used default)
    let actualBranch = branch;
    try {
      const currentBranch = await getCurrentBranch(targetDirectory);
      if (currentBranch) {
        actualBranch = currentBranch;
      }
    } catch (branchError) {
      gitCloneLogger.warn('Failed to get current branch, using requested branch', {
        repositoryUrl,
        requestedBranch: branch,
        error: branchError
      });
    }

    gitCloneLogger.info('Repository cloned successfully', {
      repositoryUrl,
      branch: actualBranch,
      targetDirectory,
      clonedPath: targetDirectory
    });

    return {
      success: true,
      clonedPath: targetDirectory,
      branch: actualBranch
    };

  } catch (error: any) {
    gitCloneLogger.error('Failed to clone repository', {
      repositoryUrl,
      branch,
      targetDirectory,
      error: error.message,
      stack: error.stack
    });

    // Clean up partial clone if it exists
    try {
      await fs.rmdir(targetDirectory, { recursive: true });
    } catch (cleanupError) {
      gitCloneLogger.debug('No cleanup needed or cleanup failed', { cleanupError });
    }

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get the current branch of a git repository
 */
export async function getCurrentBranch(repositoryPath: string): Promise<string | null> {
  try {
    const result = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: repositoryPath,
      encoding: 'utf8',
      timeout: 5000
    });

    return result.trim();
  } catch (error: any) {
    gitCloneLogger.debug('Failed to get current branch', {
      repositoryPath,
      error: error.message
    });
    return null;
  }
}

/**
 * Check if a directory is a git repository
 */
export async function isGitRepository(directoryPath: string): Promise<boolean> {
  try {
    const gitDir = path.join(directoryPath, '.git');
    await fs.access(gitDir);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get repository information from a cloned repository
 */
export async function getRepositoryInfo(repositoryPath: string): Promise<{
  remoteUrl?: string;
  currentBranch?: string;
  commitHash?: string;
  commitMessage?: string;
}> {
  const info: any = {};

  try {
    // Get remote URL
    try {
      const remoteUrl = execSync('git config --get remote.origin.url', {
        cwd: repositoryPath,
        encoding: 'utf8',
        timeout: 5000
      }).trim();
      info.remoteUrl = remoteUrl;
    } catch (remoteError) {
      gitCloneLogger.debug('Failed to get remote URL', { repositoryPath, error: remoteError });
    }

    // Get current branch
    info.currentBranch = await getCurrentBranch(repositoryPath);

    // Get current commit hash
    try {
      const commitHash = execSync('git rev-parse HEAD', {
        cwd: repositoryPath,
        encoding: 'utf8',
        timeout: 5000
      }).trim();
      info.commitHash = commitHash;
    } catch (commitError) {
      gitCloneLogger.debug('Failed to get commit hash', { repositoryPath, error: commitError });
    }

    // Get current commit message
    try {
      const commitMessage = execSync('git log -1 --pretty=format:"%s"', {
        cwd: repositoryPath,
        encoding: 'utf8',
        timeout: 5000
      }).trim();
      info.commitMessage = commitMessage;
    } catch (messageError) {
      gitCloneLogger.debug('Failed to get commit message', { repositoryPath, error: messageError });
    }

  } catch (error: any) {
    gitCloneLogger.error('Failed to get repository info', {
      repositoryPath,
      error: error.message
    });
  }

  return info;
}

/**
 * Update repository to latest commit on current branch
 */
export async function updateRepository(repositoryPath: string): Promise<GitCloneResult> {
  try {
    gitCloneLogger.info('Updating repository', { repositoryPath });

    // Verify it's a git repository
    if (!(await isGitRepository(repositoryPath))) {
      return {
        success: false,
        error: 'Directory is not a git repository'
      };
    }

    // Execute git pull
    await executeGitCommand('git', ['pull', 'origin'], 30000, repositoryPath);

    const currentBranch = await getCurrentBranch(repositoryPath);

    gitCloneLogger.info('Repository updated successfully', {
      repositoryPath,
      branch: currentBranch
    });

    return {
      success: true,
      clonedPath: repositoryPath,
      branch: currentBranch || 'main'
    };

  } catch (error: any) {
    gitCloneLogger.error('Failed to update repository', {
      repositoryPath,
      error: error.message
    });

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Execute a git command with timeout and error handling
 */
async function executeGitCommand(
  command: string, 
  args: string[], 
  timeout: number = 60000,
  cwd?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    gitCloneLogger.debug('Executing git command', { command, args, cwd, timeout });

    const process = spawn(command, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    const timeoutHandle = setTimeout(() => {
      process.kill('SIGTERM');
      reject(new Error(`Git command timed out after ${timeout}ms`));
    }, timeout);

    process.on('close', (code) => {
      clearTimeout(timeoutHandle);

      if (code === 0) {
        gitCloneLogger.debug('Git command completed successfully', {
          command,
          args,
          code,
          stdout: stdout.substring(0, 200)
        });
        resolve(stdout);
      } else {
        const error = new Error(`Git command failed with exit code ${code}: ${stderr || stdout}`);
        gitCloneLogger.error('Git command failed', {
          command,
          args,
          code,
          stderr,
          stdout
        });
        reject(error);
      }
    });

    process.on('error', (error) => {
      clearTimeout(timeoutHandle);
      gitCloneLogger.error('Git command process error', {
        command,
        args,
        error: error.message
      });
      reject(error);
    });
  });
}

/**
 * Clean up a cloned repository (remove directory)
 */
export async function cleanupRepository(repositoryPath: string): Promise<boolean> {
  try {
    gitCloneLogger.info('Cleaning up repository', { repositoryPath });

    await fs.rmdir(repositoryPath, { recursive: true });

    gitCloneLogger.info('Repository cleaned up successfully', { repositoryPath });
    return true;

  } catch (error: any) {
    gitCloneLogger.error('Failed to cleanup repository', {
      repositoryPath,
      error: error.message
    });
    return false;
  }
}

/**
 * Validate that git is available on the system
 */
export async function validateGitAvailability(): Promise<{ available: boolean; version?: string; error?: string }> {
  try {
    const version = execSync('git --version', {
      encoding: 'utf8',
      timeout: 5000
    }).trim();

    gitCloneLogger.debug('Git availability check passed', { version });

    return {
      available: true,
      version
    };

  } catch (error: any) {
    gitCloneLogger.error('Git not available', { error: error.message });

    return {
      available: false,
      error: error.message
    };
  }
}
