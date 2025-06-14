/**
 * Logging utility for Docker operations and general application logging
 */

import { LogLevel, LogEntry } from '../docker/types';

class Logger {
  private component: string;

  constructor(component: string = 'App') {
    this.component = component;
  }

  private formatMessage(level: LogLevel, message: string, details?: any): string {
    const timestamp = new Date().toISOString();
    const prefix = this.getLogPrefix(level);
    
    let formattedMessage = `${prefix} [${timestamp}] [${this.component}] ${message}`;
    
    if (details) {
      formattedMessage += `\n${JSON.stringify(details, null, 2)}`;
    }
    
    return formattedMessage;
  }

  private getLogPrefix(level: LogLevel): string {
    switch (level) {
      case LogLevel.ERROR:
        return '❌';
      case LogLevel.WARN:
        return '⚠️ ';
      case LogLevel.INFO:
        return 'ℹ️ ';
      case LogLevel.DEBUG:
        return '🔍';
      default:
        return '📝';
    }
  }

  private log(level: LogLevel, message: string, details?: any): void {
    const formattedMessage = this.formatMessage(level, message, details);
    
    switch (level) {
      case LogLevel.ERROR:
        console.error(formattedMessage);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        break;
      case LogLevel.DEBUG:
        // Only show debug logs if DEBUG env var is set
        if (process.env.DEBUG) {
          console.log(formattedMessage);
        }
        break;
      default:
        console.log(formattedMessage);
    }
  }

  error(message: string, details?: any): void {
    this.log(LogLevel.ERROR, message, details);
  }

  warn(message: string, details?: any): void {
    this.log(LogLevel.WARN, message, details);
  }

  info(message: string, details?: any): void {
    this.log(LogLevel.INFO, message, details);
  }

  debug(message: string, details?: any): void {
    this.log(LogLevel.DEBUG, message, details);
  }

  // Create a child logger with a different component name
  child(component: string): Logger {
    return new Logger(`${this.component}:${component}`);
  }
}

// Export singleton instances for common components
export const logger = new Logger('Amplify');
export const dockerLogger = new Logger('Docker');

// Export the Logger class for creating custom instances
export { Logger };
