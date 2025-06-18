import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { LogTailer, LogLine } from '../../services/logTailer';
import { LogTailerWithParser } from '../../services/logTailerWithParser';
import { ThreadMessage } from '../../types/threadMessage';

describe('LogTailer', () => {
  let tempDir: string;
  let logFile: string;
  let logTailer: LogTailer;

  beforeEach(() => {
    // Create temporary directory and file
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'amp-log-test-'));
    logFile = path.join(tempDir, 'test.log');
  });

  afterEach(() => {
    // Clean up
    if (logTailer) {
      logTailer.stop();
    }
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('should read existing file content', async () => {
    // Create file with initial content
    const initialContent = 'line 1\nline 2\nline 3\n';
    fs.writeFileSync(logFile, initialContent);

    const lines: LogLine[] = [];
    logTailer = new LogTailer(logFile, 'test-worker');
    
    logTailer.on('line', (line) => {
      lines.push(line);
    });

    await logTailer.start();

    // Wait a bit for file reading
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(lines).toHaveLength(3);
    expect(lines[0]?.content).toBe('line 1');
    expect(lines[1]?.content).toBe('line 2');
    expect(lines[2]?.content).toBe('line 3');
    expect(lines[0]?.lineNumber).toBe(1);
    expect(lines[2]?.lineNumber).toBe(3);
  });

  test('should detect new lines appended to file', async () => {
    // Create empty file
    fs.writeFileSync(logFile, '');

    const lines: LogLine[] = [];
    logTailer = new LogTailer(logFile, 'test-worker');
    
    logTailer.on('line', (line) => {
      lines.push(line);
    });

    await logTailer.start();

    // Wait for initial setup
    await new Promise(resolve => setTimeout(resolve, 100));

    // Append new lines
    fs.appendFileSync(logFile, 'new line 1\n');
    fs.appendFileSync(logFile, 'new line 2\n');

    // Wait for file watching to detect changes
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines.some(line => line.content === 'new line 1')).toBe(true);
    expect(lines.some(line => line.content === 'new line 2')).toBe(true);
  });

  test('should handle non-existent file gracefully', async () => {
    const nonExistentFile = path.join(tempDir, 'nonexistent.log');
    
    const lines: LogLine[] = [];
    logTailer = new LogTailer(nonExistentFile, 'test-worker');
    
    logTailer.on('line', (line) => {
      lines.push(line);
    });
    
    logTailer.on('error', (error) => {
      // Should not emit errors for non-existent files
      fail(`Unexpected error: ${error}`);
    });

    await logTailer.start();

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(lines).toHaveLength(0);
    expect(logTailer.getPosition()).toBe(0);
    expect(logTailer.getLineNumber()).toBe(0);
  });
});

describe('LogTailerWithParser', () => {
  let tempDir: string;
  let logFile: string;
  let tailerWithParser: LogTailerWithParser;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'amp-log-parser-test-'));
    logFile = path.join(tempDir, 'amp.log');
  });

  afterEach(() => {
    if (tailerWithParser) {
      tailerWithParser.stop();
    }
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('should parse amp log entries into thread messages', async () => {
    // Create file with sample amp log entries
    const ampLogEntries = [
      '{"level":"info","message":"marked output","timestamp":"2024-12-17T10:30:45.123Z","event":{"type":"thread-state","thread":{"id":"thread_123","title":"Test Thread","messages":[{"role":"user","content":[{"type":"text","text":"Hello"}]}]}},"out":""}',
      '{"level":"info","message":"marked output","timestamp":"2024-12-17T10:31:00.456Z","pipedInput":"continue","out":"I will help you with that task."}',
    ].join('\n') + '\n';
    
    fs.writeFileSync(logFile, ampLogEntries);

    const threadMessages: ThreadMessage[] = [];
    const logLines: LogLine[] = [];

    tailerWithParser = new LogTailerWithParser(
      logFile,
      'test-worker',
      (logLine) => {
        logLines.push(logLine);
      },
      (message) => {
        threadMessages.push(message);
      }
    );

    await tailerWithParser.start();

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 200));

    // Force final processing
    tailerWithParser.processFinalConversation();

    expect(logLines.length).toBeGreaterThanOrEqual(2);
    expect(threadMessages.length).toBeGreaterThan(0);
    
    // Should have parsed at least some messages
    const systemMessages = threadMessages.filter(msg => msg.type === 'system');
    const userMessages = threadMessages.filter(msg => msg.type === 'user');
    const assistantMessages = threadMessages.filter(msg => msg.type === 'assistant');

    expect(systemMessages.length).toBeGreaterThan(0); // Thread title message
    expect(userMessages.length).toBeGreaterThan(0); // User input from thread state
    expect(assistantMessages.length).toBeGreaterThan(0); // Assistant response from marked output
  });

  test('should handle real-time log appends', async () => {
    // Start with empty file
    fs.writeFileSync(logFile, '');

    const threadMessages: ThreadMessage[] = [];
    
    tailerWithParser = new LogTailerWithParser(
      logFile,
      'test-worker',
      undefined,
      (message) => {
        threadMessages.push(message);
      }
    );

    await tailerWithParser.start();

    // Wait for setup
    await new Promise(resolve => setTimeout(resolve, 100));

    // Append new log entry
    const newEntry = '{"level":"info","message":"marked output","timestamp":"2024-12-17T10:32:00.000Z","pipedInput":"test message","out":"This is a test response."}\n';
    fs.appendFileSync(logFile, newEntry);

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(threadMessages.length).toBeGreaterThan(0);
    expect(threadMessages.some(msg => msg.content.includes('test message'))).toBe(true);
    expect(threadMessages.some(msg => msg.content.includes('This is a test response'))).toBe(true);
  });
});
