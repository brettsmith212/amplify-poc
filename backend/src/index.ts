#!/usr/bin/env node

import { Command } from 'commander';
import { createImageManager } from './docker/imageManager';
import { createContainerManager } from './docker/containerManager';
import { validateEnvironment, logEnvironmentStatus, generateSessionId, getContainerEnvironment } from './config/environment';
import { WebServer, WebServerConfig } from './server/webServer';
import { DockerExecManager } from './docker/execManager';
import { logger } from './utils/logger';
import { dirname, resolve } from 'path';

const program = new Command();

program
  .name('amplify')
  .description('Amplify POC - Docker container with amp CLI in browser terminal')
  .version('0.1.0');

program
  .command('start')
  .description('Start the Amplify environment')
  .action(async () => {
    try {
      logger.info('Starting Amplify environment...');
      
      // Get project root - go up from backend/dist to project root
      const projectRoot = resolve(__dirname, '../../');
      logger.debug('Project root', { projectRoot });
      
      // Step 1: Check/build Docker base image
      logger.info('Step 1: Checking Docker base image...');
      const imageManager = createImageManager(projectRoot);
      
      // Check Docker availability
      const dockerAvailable = await imageManager.isDockerAvailable();
      if (!dockerAvailable) {
        logger.error('Docker is not available. Please ensure Docker is installed and running.');
        process.exit(1);
      }
      
      // Ensure base image exists
      const imageResult = await imageManager.ensureImage();
      if (!imageResult.exists) {
        logger.error('Failed to ensure base image is available', { error: imageResult.error });
        process.exit(1);
      }
      
      logger.info('✅ Docker base image is ready');
      
      // Step 2: Validate environment and start container
      logger.info('Step 2: Setting up container environment...');
      
      const sessionId = generateSessionId();
      const workspaceDir = process.cwd();
      
      const envValidation = validateEnvironment(workspaceDir, sessionId);
      logEnvironmentStatus(envValidation);
      
      if (!envValidation.isValid || !envValidation.config) {
        logger.error('Environment validation failed, cannot proceed');
        process.exit(1);
      }
      
      // Create and start container
      logger.info('Step 3: Starting container...');
      const containerManager = createContainerManager();
      
      const containerConfig = {
        sessionId: envValidation.config.sessionId,
        workspaceDir: envValidation.config.workspaceDir,
        environment: getContainerEnvironment(envValidation.config),
        baseImage: 'amplify-base'
      };
      
      const runResult = await containerManager.runContainer(containerConfig);
      if (!runResult.success) {
        logger.error('Failed to start container', { error: runResult.error });
        process.exit(1);
      }
      
      logger.info('✅ Container is running', {
        sessionId,
        containerId: runResult.containerId?.substring(0, 12)
      });
      
      // Step 4: Create exec manager and start web server
      logger.info('Step 4: Starting web server with terminal support...');
      
      // Create exec manager for the running container
      const docker = containerManager.getDocker();
      const execManager = new DockerExecManager(docker, runResult.containerId!);
      
      // Configure web server with exec manager
      const webServerConfig: WebServerConfig = {
        port: 3000,
        host: 'localhost',
        projectRoot,
        execManager
      };
      
      const webServer = new WebServer(webServerConfig);
      const webServerResult = await webServer.start();
      
      if (!webServerResult.success) {
        logger.error('Failed to start web server', { error: webServerResult.error });
        process.exit(1);
      }
      
      logger.info('✅ Web server is running', {
        url: webServerResult.url
      });
      
      logger.info('📝 Next steps (not implemented yet):');
      logger.info('   6. Auto-launch browser');
      
      logger.info('🎉 Amplify is ready!');
      logger.info(`🌐 Open your browser to: ${webServerResult.url}`);
      logger.info('🔄 Press Ctrl+C to stop.');
      
      // Simple keep-alive loop
      setInterval(() => {
        // This keeps the process alive and allows cleanup handlers to work
      }, 1000);
      
    } catch (error) {
      logger.error('Error starting Amplify', error);
      process.exit(1);
    }
  });

// Default command
program
  .action(async () => {
    // Run start command by default
    await program.parseAsync(['start'], { from: 'user' });
  });

// Only parse if this file is run directly
if (require.main === module) {
  program.parse();
}

export { program };
