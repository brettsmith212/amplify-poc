#!/usr/bin/env node

import { Command } from 'commander';

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
      console.log('🚀 Starting Amplify environment...');
      console.log('📝 This will:');
      console.log('   1. Check/build Docker base image');
      console.log('   2. Start container with current repo mounted');
      console.log('   3. Launch web terminal in browser');
      console.log('');
      console.log('⚠️  Not implemented yet - see implementation plan');
    } catch (error) {
      console.error('❌ Error starting Amplify:', error);
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
