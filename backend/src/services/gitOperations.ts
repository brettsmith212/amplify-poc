/**
 * Git operations service for executing git commands in Docker containers
 */

import { ContainerManager } from '../docker/containerManager';
import { sessionStore } from './sessionStore';
import { logger } from '../utils/logger';

const gitLogger = logger.child('GitOperations');

export interface GitCommitOptions {
  message: string;
  description?: string;
  files?: string[];
  author?: {
    name: string;
    email: string;
  };
}

export interface GitPushOptions {
  force?: boolean;
  createPullRequest?: boolean;
  pullRequestTitle?: string;
  pullRequestDescription?: string;
}

export interface GitOperationResult {
  success: boolean;
  message?: string;
  error?: string;
  commitHash?: string;
  pullRequestUrl?: string;
}

export class GitOperationsService {
  private containerManager: ContainerManager;

  constructor() {
    this.containerManager = new ContainerManager();
  }

  /**
   * Execute a git command in the session container
   */
  private async executeGitCommand(
    sessionId: string,
    command: string[],
    workingDir?: string
  ): Promise<{ success: boolean; output: string; error?: string }> {
    try {
      const session = sessionStore.getSession(sessionId);
      if (!session || !session.containerId) {
        return {
          success: false,
          output: '',
          error: 'Session container not found'
        };
      }

      gitLogger.debug('Executing git command', {
        sessionId,
        containerId: session.containerId,
        command: command.join(' ')
      });

      // Execute command in container within the repository directory
      // Extract just the repo name from owner/repo format
      const repoName = session.repositoryName.split('/').pop() || session.repositoryName;
      const repositoryPath = `/workspace/${repoName}`;
      const exec = await this.containerManager.executeCommand(
        session.containerId,
        ['git', ...command],
        repositoryPath
      );

      // Start the exec and capture output
      const stream = await exec.start();
      let output = '';
      
      stream.on('data', (chunk: Buffer) => {
        output += chunk.toString();
      });

      // Wait for exec to complete
      const result = await new Promise<{ exitCode: number; output: string }>((resolve) => {
        stream.on('end', async () => {
          const inspectResult = await exec.inspect();
          resolve({
            exitCode: inspectResult.ExitCode || 0,
            output: output.trim()
          });
        });
      });

      return {
        success: result.exitCode === 0,
        output: result.output,
        ...(result.exitCode !== 0 && { error: result.output })
      };

    } catch (error: any) {
      gitLogger.error('Failed to execute git command', {
        sessionId,
        command: command.join(' '),
        error: error.message
      });

      return {
        success: false,
        output: '',
        error: error.message
      };
    }
  }

  /**
   * Get the status of the git repository
   */
  async getStatus(sessionId: string): Promise<GitOperationResult> {
    try {
      const result = await this.executeGitCommand(sessionId, ['status', '--porcelain']);
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to get git status'
        };
      }

      const hasChanges = result.output.trim().length > 0;
      
      return {
        success: true,
        message: hasChanges ? 'Repository has uncommitted changes' : 'Working tree clean',
        // Include change details in result for frontend consumption
      };

    } catch (error: any) {
      gitLogger.error('Failed to get git status', {
        sessionId,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get diff of changes in the repository
   */
  async getDiff(sessionId: string): Promise<GitOperationResult & { diff?: string }> {
    try {
      // Get diff of all changes (staged + unstaged) without color codes
      const result = await this.executeGitCommand(sessionId, ['diff', '--no-color', 'HEAD']);
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to get git diff'
        };
      }

      return {
        success: true,
        message: 'Diff retrieved successfully',
        diff: result.output
      };

    } catch (error: any) {
      gitLogger.error('Failed to get git diff', {
        sessionId,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Commit changes to the repository
   */
  async commit(sessionId: string, options: GitCommitOptions): Promise<GitOperationResult> {
    try {
      gitLogger.info('Committing changes', {
        sessionId,
        message: options.message,
        hasDescription: !!options.description,
        fileCount: options.files?.length || 'all'
      });

      // Configure git user if provided
      if (options.author) {
        await this.executeGitCommand(sessionId, ['config', 'user.name', options.author.name]);
        await this.executeGitCommand(sessionId, ['config', 'user.email', options.author.email]);
      }

      // Add files to staging area
      if (options.files && options.files.length > 0) {
        // Add specific files
        for (const file of options.files) {
          const addResult = await this.executeGitCommand(sessionId, ['add', file]);
          if (!addResult.success) {
            return {
              success: false,
              error: `Failed to add file ${file}: ${addResult.error}`
            };
          }
        }
      } else {
        // Add all changes
        const addResult = await this.executeGitCommand(sessionId, ['add', '.']);
        if (!addResult.success) {
          return {
            success: false,
            error: `Failed to add changes: ${addResult.error}`
          };
        }
      }

      // Prepare commit message
      let commitMessage = options.message;
      if (options.description) {
        commitMessage += `\n\n${options.description}`;
      }

      // Commit changes
      const commitResult = await this.executeGitCommand(sessionId, [
        'commit',
        '-m',
        commitMessage
      ]);

      if (!commitResult.success) {
        return {
          success: false,
          error: commitResult.error || 'Failed to commit changes'
        };
      }

      // Get the commit hash
      const hashResult = await this.executeGitCommand(sessionId, ['rev-parse', 'HEAD']);
      const commitHash = hashResult.success ? hashResult.output.trim() : undefined;

      gitLogger.info('Changes committed successfully', {
        sessionId,
        commitHash,
        message: options.message
      });

      return {
        success: true,
        message: 'Changes committed successfully',
        ...(commitHash && { commitHash })
      };

    } catch (error: any) {
      gitLogger.error('Failed to commit changes', {
        sessionId,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Push changes to remote repository
   */
  async push(sessionId: string, options: GitPushOptions = {}): Promise<GitOperationResult> {
    try {
      gitLogger.info('Pushing changes', {
        sessionId,
        force: options.force,
        createPR: options.createPullRequest
      });

      // Get current branch
      const branchResult = await this.executeGitCommand(sessionId, ['branch', '--show-current']);
      if (!branchResult.success) {
        return {
          success: false,
          error: 'Failed to get current branch'
        };
      }

      const currentBranch = branchResult.output.trim();

      // Prepare push command
      const pushCommand = ['push'];
      if (options.force) {
        pushCommand.push('--force');
      }
      pushCommand.push('origin', currentBranch);

      // Push changes
      const pushResult = await this.executeGitCommand(sessionId, pushCommand);

      if (!pushResult.success) {
        return {
          success: false,
          error: pushResult.error || 'Failed to push changes'
        };
      }

      let pullRequestUrl: string | undefined;

      // Create pull request if requested
      if (options.createPullRequest) {
        // Note: This would require GitHub CLI (gh) to be installed in the container
        // For now, we'll return a success but mention PR creation is not implemented
        gitLogger.info('Pull request creation requested but not implemented', {
          sessionId,
          title: options.pullRequestTitle
        });
      }

      gitLogger.info('Changes pushed successfully', {
        sessionId,
        branch: currentBranch,
        force: options.force
      });

      return {
        success: true,
        message: 'Changes pushed successfully',
        ...(pullRequestUrl && { pullRequestUrl })
      };

    } catch (error: any) {
      gitLogger.error('Failed to push changes', {
        sessionId,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get commit log
   */
  async getLog(sessionId: string, limit: number = 10): Promise<GitOperationResult & { commits?: any[] }> {
    try {
      const result = await this.executeGitCommand(sessionId, [
        'log',
        `--max-count=${limit}`,
        '--pretty=format:%H|%an|%ae|%ad|%s',
        '--date=iso'
      ]);

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to get commit log'
        };
      }

      const commits = result.output
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [hash, author, email, date, message] = line.split('|');
          return {
            hash,
            author,
            email,
            date,
            message
          };
        });

      return {
        success: true,
        message: 'Commit log retrieved successfully',
        commits
      };

    } catch (error: any) {
      gitLogger.error('Failed to get commit log', {
        sessionId,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }
}

export const gitOperationsService = new GitOperationsService();
