import { logger } from './logger';

export enum ErrorCode {
  // Environment/Setup Errors
  DOCKER_NOT_AVAILABLE = 'DOCKER_NOT_AVAILABLE',
  GIT_REPO_NOT_FOUND = 'GIT_REPO_NOT_FOUND',
  MISSING_ENV_VAR = 'MISSING_ENV_VAR',
  
  // Docker Errors
  IMAGE_BUILD_FAILED = 'IMAGE_BUILD_FAILED',
  CONTAINER_CREATE_FAILED = 'CONTAINER_CREATE_FAILED',
  CONTAINER_START_FAILED = 'CONTAINER_START_FAILED',
  CONTAINER_EXEC_FAILED = 'CONTAINER_EXEC_FAILED',
  
  // Server Errors
  WEB_SERVER_START_FAILED = 'WEB_SERVER_START_FAILED',
  WEBSOCKET_CONNECTION_FAILED = 'WEBSOCKET_CONNECTION_FAILED',
  PORT_IN_USE = 'PORT_IN_USE',
  
  // Browser Errors
  BROWSER_LAUNCH_FAILED = 'BROWSER_LAUNCH_FAILED',
  
  // General Errors
  UNEXPECTED_ERROR = 'UNEXPECTED_ERROR',
  CLEANUP_FAILED = 'CLEANUP_FAILED'
}

export interface AmplifyError extends Error {
  code: ErrorCode;
  userMessage: string;
  originalError?: Error | undefined;
  suggestions?: string[];
  exitCode?: number;
}

export class AmplifyErrorHandler {
  private static createError(
    code: ErrorCode,
    userMessage: string,
    originalError?: Error | undefined,
    suggestions: string[] = [],
    exitCode: number = 1
  ): AmplifyError {
    const error = new Error(userMessage) as AmplifyError;
    error.code = code;
    error.userMessage = userMessage;
    error.originalError = originalError || undefined;
    error.suggestions = suggestions;
    error.exitCode = exitCode;
    return error;
  }

  static dockerNotAvailable(originalError?: Error): AmplifyError {
    return this.createError(
      ErrorCode.DOCKER_NOT_AVAILABLE,
      'Docker is not available or not running.',
      originalError,
      [
        'Make sure Docker Desktop is installed and running',
        'Check that your user has permission to access Docker',
        'Try running: docker version'
      ]
    );
  }

  static gitRepoNotFound(workingDir?: string): AmplifyError {
    return this.createError(
      ErrorCode.GIT_REPO_NOT_FOUND,
      `No git repository found${workingDir ? ` in ${workingDir}` : ''}.`,
      undefined,
      [
        'Navigate to a directory that contains a git repository',
        'Initialize a git repository with: git init',
        'Clone an existing repository with: git clone <url>'
      ]
    );
  }

  static missingEnvVar(varName: string): AmplifyError {
    return this.createError(
      ErrorCode.MISSING_ENV_VAR,
      `Required environment variable ${varName} is not set.`,
      undefined,
      [
        `Set the environment variable: export ${varName}=<value>`,
        'Check your .env file or shell configuration',
        'Contact your team for the correct environment variable values'
      ]
    );
  }

  static imageBuildFailed(originalError?: Error): AmplifyError {
    return this.createError(
      ErrorCode.IMAGE_BUILD_FAILED,
      'Failed to build or find the Docker base image.',
      originalError,
      [
        'Check that Docker is running and has sufficient disk space',
        'Try building the image manually: ./scripts/build-base-image.sh',
        'Check your internet connection for downloading base images'
      ]
    );
  }

  static containerCreateFailed(originalError?: Error): AmplifyError {
    return this.createError(
      ErrorCode.CONTAINER_CREATE_FAILED,
      'Failed to create Docker container.',
      originalError,
      [
        'Check that Docker is running properly',
        'Verify that the base image exists',
        'Check available disk space and memory'
      ]
    );
  }

  static containerStartFailed(containerId?: string, originalError?: Error): AmplifyError {
    return this.createError(
      ErrorCode.CONTAINER_START_FAILED,
      `Failed to start Docker container${containerId ? ` ${containerId.substring(0, 12)}` : ''}.`,
      originalError,
      [
        'Check Docker logs for more details',
        'Verify that required ports are available',
        'Check that the container image is not corrupted'
      ]
    );
  }

  static webServerStartFailed(port: number, originalError?: Error): AmplifyError {
    const isPortError = originalError?.message.includes('EADDRINUSE') || 
                       originalError?.message.includes('address already in use');
    
    if (isPortError) {
      return this.createError(
        ErrorCode.PORT_IN_USE,
        `Port ${port} is already in use.`,
        originalError,
        [
          `Stop the process using port ${port}`,
          `Use a different port: --port <port>`,
          `Find the process: lsof -i :${port} or netstat -tulpn | grep ${port}`
        ]
      );
    }

    return this.createError(
      ErrorCode.WEB_SERVER_START_FAILED,
      `Failed to start web server on port ${port}.`,
      originalError,
      [
        'Check that the port is available',
        'Verify firewall settings',
        'Try a different port with --port <port>'
      ]
    );
  }

  static browserLaunchFailed(originalError?: Error): AmplifyError {
    return this.createError(
      ErrorCode.BROWSER_LAUNCH_FAILED,
      'Failed to automatically launch browser.',
      originalError,
      [
        'Open your browser manually and navigate to the provided URL',
        'Check that a default browser is configured',
        'Use --no-browser flag to skip automatic browser launch'
      ],
      0 // Not a fatal error, continue execution
    );
  }

  static unexpectedError(originalError: Error): AmplifyError {
    return this.createError(
      ErrorCode.UNEXPECTED_ERROR,
      'An unexpected error occurred.',
      originalError,
      [
        'Try running the command again',
        'Check that all prerequisites are met',
        'Report this issue if it persists'
      ]
    );
  }

  static cleanupFailed(originalError?: Error): AmplifyError {
    return this.createError(
      ErrorCode.CLEANUP_FAILED,
      'Failed to clean up resources properly.',
      originalError,
      [
        'Some Docker containers or resources may still be running',
        'Check running containers: docker ps',
        'Manual cleanup may be required: docker container prune'
      ],
      0 // Don't exit with error code for cleanup failures
    );
  }

  static handle(error: Error | AmplifyError, context?: string): never {
    const amplifyError = this.isAmplifyError(error) ? error : this.unexpectedError(error);
    
    // Log the full error for debugging
    logger.error(`${context ? `[${context}] ` : ''}Amplify error occurred:`, {
      code: amplifyError.code,
      message: amplifyError.userMessage,
      originalError: amplifyError.originalError?.message,
      stack: amplifyError.originalError?.stack
    });

    // Display user-friendly error message
    console.error(`\n❌ ${amplifyError.userMessage}\n`);

    if (amplifyError.suggestions && amplifyError.suggestions.length > 0) {
      console.error('💡 Suggestions:');
      amplifyError.suggestions.forEach((suggestion, index) => {
        console.error(`   ${index + 1}. ${suggestion}`);
      });
      console.error();
    }

    // Show technical details in verbose mode
    if (process.env.LOG_LEVEL === 'debug' && amplifyError.originalError) {
      console.error('🔧 Technical details:');
      console.error(`   Error: ${amplifyError.originalError.message}`);
      if (amplifyError.originalError.stack) {
        console.error(`   Stack: ${amplifyError.originalError.stack}`);
      }
      console.error();
    }

    process.exit(amplifyError.exitCode || 1);
  }

  static isAmplifyError(error: any): error is AmplifyError {
    return error && typeof error === 'object' && 'code' in error && 'userMessage' in error;
  }

  static warn(message: string, suggestions?: string[]): void {
    console.warn(`\n⚠️  ${message}\n`);
    
    if (suggestions && suggestions.length > 0) {
      console.warn('💡 Suggestions:');
      suggestions.forEach((suggestion, index) => {
        console.warn(`   ${index + 1}. ${suggestion}`);
      });
      console.warn();
    }
  }

  static info(message: string): void {
    console.log(`ℹ️  ${message}`);
  }

  static success(message: string): void {
    console.log(`✅ ${message}`);
  }
}
