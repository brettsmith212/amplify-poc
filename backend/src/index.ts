#!/usr/bin/env node

import { Command } from 'commander';
import { AmplifyCommand } from './cli/amplifyCommand';
import { logger } from './utils/logger';
import { resolve } from 'path';

const program = new Command();

program
  .name('amplify')
  .description('Amplify POC - Docker container with amp CLI in browser terminal')
  .version('0.1.0');

program
  .option('-p, --port <port>', 'port to run the web server on', '3000')
  .option('--no-browser', 'do not automatically launch browser')
  .option('-v, --verbose', 'enable verbose logging')
  .action(async (options) => {
    try {
      // Set verbose logging if requested
      if (options.verbose) {
        process.env.LOG_LEVEL = 'debug';
      }

      // Get project root - go up from backend/dist to project root
      const projectRoot = resolve(__dirname, '../../');
      
      const amplifyCommand = new AmplifyCommand(projectRoot);
      
      await amplifyCommand.execute({
        port: parseInt(options.port),
        noBrowser: !options.browser,
        verbose: options.verbose
      });
      
    } catch (error) {
      logger.error('❌ Error running Amplify:', error);
      process.exit(1);
    }
  });

// Only parse if this file is run directly
if (require.main === module) {
  program.parse();
}

export { program };
