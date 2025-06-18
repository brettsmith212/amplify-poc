import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

export interface LogLine {
  content: string;
  timestamp: Date;
  lineNumber: number;
}

export interface LogTailerOptions {
  debounceMs?: number;
  pollInterval?: number;
  encoding?: BufferEncoding;
}

export class LogTailer extends EventEmitter {
  private filePath: string;
  private workerId: string;
  private options: LogTailerOptions;
  private watcher: fs.FSWatcher | null = null;
  private lastPosition: number = 0;
  private lineNumber: number = 0;
  private debounceTimer: NodeJS.Timeout | null = null;
  private isWatching: boolean = false;
  private pollTimer: NodeJS.Timeout | null = null;

  constructor(filePath: string, workerId: string, options: LogTailerOptions = {}) {
    super();
    this.filePath = filePath;
    this.workerId = workerId;
    this.options = {
      debounceMs: 100,
      pollInterval: 1000,
      encoding: 'utf8',
      ...options
    };
  }

  /**
   * Start watching the log file for changes
   */
  async start(): Promise<void> {
    if (this.isWatching) {
      return;
    }

    this.isWatching = true;

    // Read existing content first
    await this.readExistingContent();

    // Start file watching
    this.startWatching();

    // Start polling as fallback
    this.startPolling();

    this.emit('started', { workerId: this.workerId, filePath: this.filePath });
  }

  /**
   * Stop watching the log file
   */
  stop(): void {
    if (!this.isWatching) {
      return;
    }

    this.isWatching = false;

    // Clear debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Clear poll timer
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    // Close file watcher
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    this.emit('stopped', { workerId: this.workerId });
  }

  /**
   * Get current file position
   */
  getPosition(): number {
    return this.lastPosition;
  }

  /**
   * Get current line number
   */
  getLineNumber(): number {
    return this.lineNumber;
  }

  /**
   * Read existing content from the file
   */
  private async readExistingContent(): Promise<void> {
    try {
      if (!fs.existsSync(this.filePath)) {
        // File doesn't exist yet, start from beginning
        this.lastPosition = 0;
        this.lineNumber = 0;
        return;
      }

      const stats = fs.statSync(this.filePath);
      if (stats.size === 0) {
        this.lastPosition = 0;
        this.lineNumber = 0;
        return;
      }

      // Read the entire file to get existing lines
      const content = fs.readFileSync(this.filePath, this.options.encoding!);
      const lines = content.split('\n');
      
      // Process existing lines
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line && line.trim()) {
          this.lineNumber++;
          const logLine: LogLine = {
            content: line.trim(),
            timestamp: new Date(),
            lineNumber: this.lineNumber
          };
          this.emit('line', logLine);
        }
      }

      this.lastPosition = stats.size;
    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
   * Start file watching with fs.watch
   */
  private startWatching(): void {
    try {
      // Watch the directory containing the file to handle file creation
      const dir = path.dirname(this.filePath);
      const filename = path.basename(this.filePath);

      this.watcher = fs.watch(dir, { encoding: 'utf8' }, (eventType, changedFilename) => {
        if (changedFilename === filename && (eventType === 'change' || eventType === 'rename')) {
          this.debouncedReadNewContent();
        }
      });

      this.watcher.on('error', (error) => {
        this.emit('error', error);
      });
    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
   * Start polling as a fallback mechanism
   */
  private startPolling(): void {
    this.pollTimer = setInterval(() => {
      this.readNewContent();
    }, this.options.pollInterval || 1000);
  }

  /**
   * Debounced file reading to prevent excessive reads
   */
  private debouncedReadNewContent(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.readNewContent();
    }, this.options.debounceMs || 100);
  }

  /**
   * Read new content from the file since last position
   */
  private readNewContent(): void {
    try {
      if (!fs.existsSync(this.filePath)) {
        return;
      }

      const stats = fs.statSync(this.filePath);
      
      // Check if file was truncated or rotated
      if (stats.size < this.lastPosition) {
        this.lastPosition = 0;
        this.lineNumber = 0;
        this.emit('file-rotated', { workerId: this.workerId });
      }

      // Check if there's new content
      if (stats.size === this.lastPosition) {
        return;
      }

      // Read new content
      const stream = fs.createReadStream(this.filePath, {
        start: this.lastPosition,
        encoding: this.options.encoding
      });

      let buffer = '';

      stream.on('data', (chunk: string | Buffer) => {
        const chunkStr = chunk.toString();
        buffer += chunkStr;
        
        // Process complete lines
        const lines = buffer.split('\n');
        
        // Keep the last incomplete line in buffer
        buffer = lines.pop() || '';
        
        // Process complete lines
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine) {
            this.lineNumber++;
            const logLine: LogLine = {
              content: trimmedLine,
              timestamp: new Date(),
              lineNumber: this.lineNumber
            };
            this.emit('line', logLine);
          }
        }
      });

      stream.on('end', () => {
        // Process any remaining content in buffer
        if (buffer.trim()) {
          this.lineNumber++;
          const logLine: LogLine = {
            content: buffer.trim(),
            timestamp: new Date(),
            lineNumber: this.lineNumber
          };
          this.emit('line', logLine);
        }
        
        this.lastPosition = stats.size;
      });

      stream.on('error', (error) => {
        this.emit('error', error);
      });

    } catch (error) {
      this.emit('error', error);
    }
  }
}
