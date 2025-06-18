/**
 * Service for executing amp commands and managing amp threads
 */

import { exec } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { promisify } from 'util';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);
const ampLogger = logger.child('AmpService');

export interface AmpThreadResult {
  success: boolean;
  threadId?: string;
  ampLogPath?: string;
  error?: string;
}

export interface AmpExecutionOptions {
  workingDirectory?: string;
  timeout?: number;
  environment?: Record<string, string>;
}

/**
 * AmpService handles amp command execution and thread management
 */
export class AmpService {
  private dataDir: string;

  constructor(dataDir: string = process.env.DATA_DIR || '/tmp/amplify-data') {
    this.dataDir = dataDir;
  }

  /**
   * Create a new amp thread and return thread ID and log path
   */
  async createThread(sessionId: string, options: AmpExecutionOptions = {}): Promise<AmpThreadResult> {
    try {
      ampLogger.info('Creating new amp thread', { sessionId });

      // Ensure data directory exists
      const sessionDataDir = path.join(this.dataDir, sessionId);
      await fs.mkdir(sessionDataDir, { recursive: true });

      // Define amp log path
      const ampLogPath = path.join(sessionDataDir, 'amp.log');

      // Prepare amp threads new command
      const command = 'amp threads new';
      const execOptions = {
        cwd: options.workingDirectory || sessionDataDir,
        timeout: options.timeout || 30000,
        env: {
          ...process.env,
          ...options.environment,
          AMP_LOG_FILE: ampLogPath
        }
      };

      ampLogger.debug('Executing amp threads new command', {
        sessionId,
        command,
        ampLogPath,
        workingDirectory: execOptions.cwd
      });

      // Execute amp threads new command
      const { stdout, stderr } = await execAsync(command, execOptions);

      // Parse thread ID from stdout
      const threadId = this.parseThreadIdFromOutput(stdout);

      if (!threadId) {
        ampLogger.error('Failed to parse thread ID from amp output', {
          sessionId,
          stdout,
          stderr
        });

        return {
          success: false,
          error: 'Failed to parse thread ID from amp command output'
        };
      }

      // Verify log file was created
      try {
        await fs.access(ampLogPath);
      } catch (accessError) {
        ampLogger.warn('Amp log file not created immediately, creating empty file', {
          sessionId,
          threadId,
          ampLogPath
        });

        // Create empty log file if it doesn't exist
        await fs.writeFile(ampLogPath, '');
      }

      ampLogger.info('Successfully created amp thread', {
        sessionId,
        threadId,
        ampLogPath
      });

      return {
        success: true,
        threadId,
        ampLogPath
      };

    } catch (error: any) {
      ampLogger.error('Failed to create amp thread', {
        sessionId,
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Continue an existing amp thread with user input
   */
  async continueThread(
    threadId: string, 
    userInput: string, 
    options: AmpExecutionOptions = {}
  ): Promise<AmpThreadResult> {
    try {
      ampLogger.info('Continuing amp thread', { threadId, userInput: userInput.substring(0, 100) });

      // Prepare amp threads continue command
      const command = `amp threads continue "${threadId}"`;
      const execOptions = {
        cwd: options.workingDirectory,
        timeout: options.timeout || 60000,
        env: {
          ...process.env,
          ...options.environment
        }
      };

      ampLogger.debug('Executing amp threads continue command', {
        threadId,
        command,
        workingDirectory: execOptions.cwd
      });

      // Execute command with piped input
      const childProcess = exec(command, execOptions);
      
      if (childProcess.stdin) {
        childProcess.stdin.write(userInput);
        childProcess.stdin.end();
      }

      // Wait for completion
      const result = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        let stdout = '';
        let stderr = '';

        if (childProcess.stdout) {
          childProcess.stdout.on('data', (data) => {
            stdout += data.toString();
          });
        }

        if (childProcess.stderr) {
          childProcess.stderr.on('data', (data) => {
            stderr += data.toString();
          });
        }

        childProcess.on('close', (code) => {
          if (code === 0) {
            resolve({ stdout, stderr });
          } else {
            reject(new Error(`Command exited with code ${code}. stderr: ${stderr}`));
          }
        });

        childProcess.on('error', reject);
      });

      ampLogger.info('Successfully continued amp thread', {
        threadId,
        outputLength: result.stdout.length
      });

      return {
        success: true,
        threadId
      };

    } catch (error: any) {
      ampLogger.error('Failed to continue amp thread', {
        threadId,
        userInput: userInput.substring(0, 100),
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get the amp log path for a session
   */
  getAmpLogPath(sessionId: string): string {
    return path.join(this.dataDir, sessionId, 'amp.log');
  }

  /**
   * Check if amp command is available
   */
  async checkAmpAvailability(): Promise<boolean> {
    try {
      await execAsync('amp --version', { timeout: 5000 });
      return true;
    } catch (error) {
      ampLogger.warn('Amp command not available', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Parse thread ID from amp command output
   */
  private parseThreadIdFromOutput(output: string): string | null {
    try {
      // Handle undefined or null output
      if (!output || typeof output !== 'string') {
        return null;
      }

      // Look for thread ID patterns in output
      // amp typically outputs something like "Created thread: thread_abc123"
      const threadIdMatch = output.match(/thread[_-]?([a-zA-Z0-9]+)/i);
      if (threadIdMatch) {
        return threadIdMatch[0];
      }

      // Try parsing JSON output if present
      const lines = output.split('\n').filter(line => line.trim());
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.thread?.id) {
            return parsed.thread.id;
          }
          if (parsed.threadId) {
            return parsed.threadId;
          }
        } catch {
          // Not JSON, continue
        }
      }

      // Fallback: look for any thread-like identifier
      const fallbackMatch = output.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
      if (fallbackMatch) {
        return fallbackMatch[0];
      }

      return null;
    } catch (error) {
      ampLogger.error('Error parsing thread ID from output', {
        output: output ? output.substring(0, 200) : 'undefined',
        error: (error as Error).message
      });
      return null;
    }
  }
}

// Export singleton instance
export const ampService = new AmpService();
