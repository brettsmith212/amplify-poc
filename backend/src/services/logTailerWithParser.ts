import { LogTailer, LogLine, LogTailerOptions } from './logTailer';
import { AmpLogParser } from './ampLogParser';
import { ThreadMessage } from '../types/threadMessage';
import { EventEmitter } from 'events';

export interface LogTailerWithParserOptions extends LogTailerOptions {
  // Additional options specific to parser integration
}

export class LogTailerWithParser extends EventEmitter {
  private logTailer: LogTailer;
  private ampLogParser: AmpLogParser;
  private workerId: string;
  private isRunning: boolean = false;

  constructor(
    logFilePath: string,
    workerId: string,
    onLogLine?: (logLine: LogLine) => void,
    onThreadMessage?: (message: ThreadMessage) => void,
    options: LogTailerWithParserOptions = {}
  ) {
    super();
    
    this.workerId = workerId;

    // Create AmpLogParser with thread message callback
    this.ampLogParser = new AmpLogParser(workerId, (message: ThreadMessage) => {
      // Emit the parsed message
      this.emit('thread-message', message);
      
      // Call optional callback
      if (onThreadMessage) {
        onThreadMessage(message);
      }
    });

    // Create LogTailer with wrapped callback
    this.logTailer = new LogTailer(logFilePath, workerId, options);

    // Set up event forwarding and processing
    this.setupEventHandlers(onLogLine);
  }

  /**
   * Start the log tailer and parser
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      await this.logTailer.start();
      this.emit('started', { workerId: this.workerId });
    } catch (error) {
      this.isRunning = false;
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop the log tailer and parser
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    this.logTailer.stop();
    
    // Process any final conversation state
    this.ampLogParser.processFinalConversation();
    
    this.emit('stopped', { workerId: this.workerId });
  }

  /**
   * Get the current file position
   */
  getPosition(): number {
    return this.logTailer.getPosition();
  }

  /**
   * Get the current line number
   */
  getLineNumber(): number {
    return this.logTailer.getLineNumber();
  }

  /**
   * Get the amp log parser instance
   */
  getParser(): AmpLogParser {
    return this.ampLogParser;
  }

  /**
   * Get the log tailer instance
   */
  getTailer(): LogTailer {
    return this.logTailer;
  }

  /**
   * Check if the service is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Process a single log line manually (for testing)
   */
  processLine(line: string): void {
    this.ampLogParser.parseLine(line);
  }

  /**
   * Force processing of final conversation state
   */
  processFinalConversation(): void {
    this.ampLogParser.processFinalConversation();
  }

  /**
   * Set up event handlers for log tailer
   */
  private setupEventHandlers(onLogLine?: (logLine: LogLine) => void): void {
    // Handle new log lines
    this.logTailer.on('line', (logLine: LogLine) => {
      // Forward raw log line to callback
      if (onLogLine) {
        onLogLine(logLine);
      }

      // Emit raw log line event
      this.emit('log-line', logLine);

      // Parse the line for structured thread messages
      this.ampLogParser.parseLine(logLine.content);
    });

    // Forward tailer events
    this.logTailer.on('started', (data) => {
      this.emit('tailer-started', data);
    });

    this.logTailer.on('stopped', (data) => {
      this.emit('tailer-stopped', data);
    });

    this.logTailer.on('file-rotated', (data) => {
      this.emit('file-rotated', data);
      // Reset parser state on file rotation
      this.ampLogParser = new AmpLogParser(this.workerId, (message: ThreadMessage) => {
        this.emit('thread-message', message);
      });
    });

    this.logTailer.on('error', (error) => {
      this.emit('error', error);
    });
  }
}

/**
 * Factory function to create a LogTailerWithParser instance
 */
export function createLogTailerWithParser(
  logFilePath: string,
  workerId: string,
  callbacks?: {
    onLogLine?: (logLine: LogLine) => void;
    onThreadMessage?: (message: ThreadMessage) => void;
    onError?: (error: Error) => void;
  },
  options: LogTailerWithParserOptions = {}
): LogTailerWithParser {
  const tailerWithParser = new LogTailerWithParser(
    logFilePath,
    workerId,
    callbacks?.onLogLine,
    callbacks?.onThreadMessage,
    options
  );

  // Set up error handling if provided
  if (callbacks?.onError) {
    tailerWithParser.on('error', callbacks.onError);
  }

  return tailerWithParser;
}
