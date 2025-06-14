import { validateAll } from '../utils/validation';
import { createImageManager } from '../docker/imageManager';
import { createContainerManager } from '../docker/containerManager';
import { validateEnvironment, logEnvironmentStatus, generateSessionId, getContainerEnvironment } from '../config/environment';
import { WebServer, WebServerConfig } from '../server/webServer';
import { DockerExecManager } from '../docker/execManager';
import { launchBrowserWhenReady } from './browserLauncher';
import { logger } from '../utils/logger';
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

    try {
      logger.info('🚀 Starting Amplify environment...');
      
      // Step 1: Validate prerequisites
      logger.info('Step 1: Validating environment...');
      const validation = validateAll();
      if (!validation.isValid) {
        logger.error('❌ Validation failed:', validation.error);
        process.exit(1);
      }

      // Step 2: Ensure Docker base image
      logger.info('Step 2: Checking Docker base image...');
      const imageManager = createImageManager(this.projectRoot);
      
      const dockerAvailable = await imageManager.isDockerAvailable();
      if (!dockerAvailable) {
        logger.error('❌ Docker is not available. Please ensure Docker is installed and running.');
        process.exit(1);
      }
      
      const imageResult = await imageManager.ensureImage();
      if (!imageResult.exists) {
        logger.error('❌ Failed to ensure base image is available', { error: imageResult.error });
        process.exit(1);
      }
      
      logger.info('✅ Docker base image is ready');

      // Step 3: Set up container environment
      logger.info('Step 3: Setting up container environment...');
      
      this.sessionId = generateSessionId();
      const workspaceDir = process.cwd();
      
      const envValidation = validateEnvironment(workspaceDir, this.sessionId);
      logEnvironmentStatus(envValidation);
      
      if (!envValidation.isValid || !envValidation.config) {
        logger.error('❌ Environment validation failed, cannot proceed');
        process.exit(1);
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
        logger.error('❌ Failed to start container', { error: runResult.error });
        process.exit(1);
      }
      
      this.containerId = runResult.containerId;
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
        logger.error('❌ Failed to start web server', { error: webServerResult.error });
        process.exit(1);
      }
      
      logger.info('✅ Web server is running', { url: webServerResult.url });

      // Step 6: Launch browser
      if (shouldLaunchBrowser) {
        logger.info('Step 6: Launching browser...');
        const browserResult = await launchBrowserWhenReady(webServerResult.url!);
        
        if (browserResult.success) {
          logger.info('✅ Browser launched successfully');
        } else {
          logger.warn('⚠️  Failed to launch browser automatically:', browserResult.error);
        }
      }

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      logger.info('🎉 Amplify is ready!');
      logger.info(`🌐 Terminal available at: ${webServerResult.url}`);
      if (!shouldLaunchBrowser) {
        logger.info('💡 Open your browser to the URL above to access the terminal');
      }
      logger.info('🔄 Press Ctrl+C to stop.');

      // Keep process alive
      this.keepAlive();

    } catch (error) {
      logger.error('❌ Error starting Amplify:', error);
      await this.cleanup();
      process.exit(1);
    }
  }

  private setupGracefulShutdown(): void {
    const cleanup = async () => {
      logger.info('🛑 Shutting down gracefully...');
      await this.cleanup();
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('SIGHUP', cleanup);
  }

  private async cleanup(): Promise<void> {
    try {
      if (this.webServer) {
        logger.info('Stopping web server...');
        await this.webServer.stop();
      }

      if (this.containerId) {
        logger.info('Cleaning up container...');
        const containerManager = createContainerManager();
        await containerManager.stopContainer(this.containerId);
        await containerManager.removeContainer(this.containerId);
      }

      logger.info('✅ Cleanup completed');
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }

  private keepAlive(): void {
    // Simple keep-alive to prevent process from exiting
    setInterval(() => {
      // This keeps the process alive and allows cleanup handlers to work
    }, 1000);
  }
}
