#!/usr/bin/env node

import { Command } from 'commander';
import { createImageManager } from './docker/imageManager';
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
      logger.info('📝 Next steps (not implemented yet):');
      logger.info('   2. Start container with current repo mounted');
      logger.info('   3. Launch web terminal in browser');
      
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
