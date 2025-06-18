#!/usr/bin/env ts-node

/**
 * Manual test script for LogTailerWithParser
 * Run this script and then append to the test log file to see real-time parsing
 * 
 * Usage:
 * 1. cd backend && npm run build
 * 2. ts-node src/__tests__/manual/testLogTailer.ts
 * 3. In another terminal: echo '{"level":"info","message":"marked output","timestamp":"2024-12-17T10:30:45.123Z","pipedInput":"Hello amp","out":"I will help you with that."}' >> /tmp/test-amp.log
 */

import * as fs from 'fs';
import * as path from 'path';
import { LogTailerWithParser } from '../../services/logTailerWithParser';
import { ThreadMessage } from '../../types/threadMessage';
import { LogLine } from '../../services/logTailer';

const testLogFile = '/tmp/test-amp.log';

console.log('🚀 Starting LogTailerWithParser test');
console.log(`📁 Log file: ${testLogFile}`);
console.log('👀 Watching for changes...\n');

// Create empty log file if it doesn't exist
if (!fs.existsSync(testLogFile)) {
  fs.writeFileSync(testLogFile, '');
  console.log('📝 Created empty log file');
}

const tailerWithParser = new LogTailerWithParser(
  testLogFile,
  'manual-test-worker',
  (logLine: LogLine) => {
    console.log(`📄 [Line ${logLine.lineNumber}] ${logLine.content}`);
  },
  (message: ThreadMessage) => {
    console.log(`💬 [${message.type.toUpperCase()}] ${message.content}`);
    if (message.metadata) {
      console.log(`   📊 Metadata:`, JSON.stringify(message.metadata, null, 2));
    }
  }
);

// Handle errors
tailerWithParser.on('error', (error) => {
  console.error('❌ Error:', error);
});

// Handle events
tailerWithParser.on('started', () => {
  console.log('✅ LogTailerWithParser started successfully\n');
});

tailerWithParser.on('stopped', () => {
  console.log('\n🛑 LogTailerWithParser stopped');
});

// Start the tailer
tailerWithParser.start().then(() => {
  console.log('🎯 To test real-time parsing, run in another terminal:');
  console.log(`echo '{"level":"info","message":"marked output","timestamp":"${new Date().toISOString()}","pipedInput":"Hello amp","out":"I will help you with that."}' >> ${testLogFile}`);
  console.log('\n📺 Watching for changes (Press Ctrl+C to exit)...\n');
}).catch((error) => {
  console.error('❌ Failed to start:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🔄 Shutting down...');
  tailerWithParser.stop();
  setTimeout(() => {
    console.log('👋 Goodbye!');
    process.exit(0);
  }, 100);
});

// Keep the process alive
setInterval(() => {
  // Just keep alive
}, 1000);
