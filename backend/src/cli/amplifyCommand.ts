import { validateAll } from '../utils/validation';
import { createImageManager } from '../docker/imageManager';
import { createContainerManager } from '../docker/containerManager';
import { validateEnvironment, logEnvironmentStatus, generateSessionId, getContainerEnvironment } from '../config/environment';
import { WebServer, WebServerConfig } from '../server/webServer';
import { DockerExecManager } from '../docker/execManager';
import { launchBrowserWhenReady } from './browserLauncher';
import { logger } from '../utils/logger';
import { AmplifyErrorHandler } from '../utils/errorHandler';
import { setupSignalHandlers, cleanupSignalHandlers } from '../utils/signals';
import { registerContainerCleanup, registerServerCleanup, gracefulShutdown } from './cleanup';
import { resolve } from 'path';

export interface AmplifyCommandOptions {
  port?: number;
  noBrowser?: boolean;
  verbose?: boolean;
}

export class AmplifyCommand {
  private projectRoot: string;
  private webServer?: WebServer;
  private containerId?: string;
  private sessionId?: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || resolve(__dirname, '../../');
  }

  async execute(options: AmplifyCommandOptions = {}): Promise<void> {
    const port = options.port || 3000;
    const shouldLaunchBrowser = !options.noBrowser;

    // Set up signal handlers for graceful shutdown
    setupSignalHandlers({
      gracefulTimeoutMs: 15000, // 15 seconds for graceful shutdown
      emergencyTimeoutMs: 5000   // 5 seconds for emergency cleanup
    });

    try {
      logger.info('🚀 Starting Amplify environment...');
      
      // Step 1: Validate prerequisites
      logger.info('Step 1: Validating environment...');
      
      // For development, we need to validate from the project root, not backend/
      const workspaceForValidation = process.cwd().endsWith('/backend') ? 
        resolve(process.cwd(), '..') : process.cwd();
      
      const validation = validateAll(workspaceForValidation);
      if (!validation.isValid) {
        if (validation.error?.includes('git repository')) {
          throw AmplifyErrorHandler.gitRepoNotFound(workspaceForValidation);
        } else if (validation.error?.includes('AMP_API_KEY')) {
          throw AmplifyErrorHandler.missingEnvVar('AMP_API_KEY');
        } else if (validation.error?.includes('Docker')) {
          throw AmplifyErrorHandler.dockerNotAvailable();
        } else {
          throw AmplifyErrorHandler.unexpectedError(new Error(validation.error || 'Validation failed'));
        }
      }

      // Step 2: Ensure Docker base image
      logger.info('Step 2: Checking Docker base image...');
      const imageManager = createImageManager(this.projectRoot);
      
      const dockerAvailable = await imageManager.isDockerAvailable();
      if (!dockerAvailable) {
        throw AmplifyErrorHandler.dockerNotAvailable();
      }
      
      const imageResult = await imageManager.ensureImage();
      if (!imageResult.exists) {
        throw AmplifyErrorHandler.imageBuildFailed(
          imageResult.error ? new Error(imageResult.error) : undefined
        );
      }
      
      logger.info('✅ Docker base image is ready');

      // Step 3: Set up container environment
      logger.info('Step 3: Setting up container environment...');
      
      this.sessionId = generateSessionId();
      const workspaceDir = workspaceForValidation;
      
      const envValidation = validateEnvironment(workspaceDir, this.sessionId);
      logEnvironmentStatus(envValidation);
      
      if (!envValidation.isValid || !envValidation.config) {
        throw AmplifyErrorHandler.missingEnvVar('AMP_API_KEY');
      }

      // Step 4: Start container
      logger.info('Step 4: Starting container...');
      const containerManager = createContainerManager();
      
      const containerConfig = {
        sessionId: envValidation.config.sessionId,
        workspaceDir: envValidation.config.workspaceDir,
        environment: getContainerEnvironment(envValidation.config),
        baseImage: 'amplify-base'
      };
      
      const runResult = await containerManager.runContainer(containerConfig);
      if (!runResult.success) {
        throw AmplifyErrorHandler.containerStartFailed(
          runResult.containerId,
          runResult.error ? new Error(runResult.error) : undefined
        );
      }
      
      this.containerId = runResult.containerId!;
      
      // Register container for cleanup
      registerContainerCleanup(this.containerId, this.sessionId);
      
      logger.info('✅ Container is running', {
        sessionId: this.sessionId,
        containerId: this.containerId?.substring(0, 12)
      });

      // Step 5: Start web server with terminal support
      logger.info('Step 5: Starting web server...');
      
      const docker = containerManager.getDocker();
      const execManager = new DockerExecManager(docker, this.containerId!);
      
      const webServerConfig: WebServerConfig = {
        port,
        host: 'localhost',
        projectRoot: this.projectRoot,
        execManager
      };
      
      this.webServer = new WebServer(webServerConfig);
      const webServerResult = await this.webServer.start();
      
      if (!webServerResult.success) {
        throw AmplifyErrorHandler.webServerStartFailed(
          port,
          webServerResult.error ? new Error(webServerResult.error) : undefined
        );
      }
      
      // Register web server for cleanup
      registerServerCleanup('main-server', this.webServer);
      
      logger.info('✅ Web server is running', { url: webServerResult.url });

      // Step 6: Launch browser
      if (shouldLaunchBrowser) {
        logger.info('Step 6: Launching browser...');
        const browserResult = await launchBrowserWhenReady(webServerResult.url!);
        
        if (browserResult.success) {
          logger.info('✅ Browser launched successfully');
        } else {
          // Browser launch failure is not fatal
          AmplifyErrorHandler.warn(
            'Failed to launch browser automatically',
            ['Open your browser manually and navigate to: ' + webServerResult.url]
          );
        }
      }

      AmplifyErrorHandler.success('Amplify is ready!');
      AmplifyErrorHandler.info(`🌐 Terminal available at: ${webServerResult.url}`);
      if (!shouldLaunchBrowser) {
        AmplifyErrorHandler.info('💡 Open your browser to the URL above to access the terminal');
      }
      AmplifyErrorHandler.info('🔄 Press Ctrl+C to stop.');

      // Keep process alive
      this.keepAlive();

    } catch (error) {
      // Clean up signal handlers
      cleanupSignalHandlers();
      
      // Handle the error appropriately
      if (AmplifyErrorHandler.isAmplifyError(error)) {
        AmplifyErrorHandler.handle(error, 'AmplifyCommand.execute');
      } else {
        AmplifyErrorHandler.handle(error instanceof Error ? error : new Error(String(error)), 'AmplifyCommand.execute');
      }
    }
  }



  private keepAlive(): void {
    // Simple keep-alive to prevent process from exiting
    setInterval(() => {
      // This keeps the process alive and allows cleanup handlers to work
    }, 1000);
  }
}
