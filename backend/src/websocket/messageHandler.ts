import { logger } from '../utils/logger';

export interface TerminalMessage {
  type: 'input' | 'output' | 'resize' | 'control';
  data: string | ResizeData | ControlData;
  timestamp: number;
}

export interface ResizeData {
  cols: number;
  rows: number;
}

export interface ControlData {
  signal: 'SIGINT' | 'SIGTERM' | 'SIGKILL';
}

export type MessageHandler = (message: TerminalMessage) => void | Promise<void>;

export class WebSocketMessageHandler {
  private handlers: Map<string, MessageHandler[]> = new Map();

  constructor() {
    // Initialize default handlers
    this.setupDefaultHandlers();
  }

  private setupDefaultHandlers(): void {
    // Log all messages for debugging
    this.on('*', (message) => {
      logger.debug(`WebSocket message received: ${message.type}`, {
        type: message.type,
        dataLength: typeof message.data === 'string' ? message.data.length : JSON.stringify(message.data).length,
        timestamp: message.timestamp
      });
    });
  }

  on(messageType: string, handler: MessageHandler): void {
    if (!this.handlers.has(messageType)) {
      this.handlers.set(messageType, []);
    }
    this.handlers.get(messageType)!.push(handler);
  }

  off(messageType: string, handler: MessageHandler): void {
    const handlers = this.handlers.get(messageType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  async handleMessage(rawMessage: string): Promise<void> {
    try {
      const message: TerminalMessage = JSON.parse(rawMessage);
      
      // Validate message structure
      if (!this.isValidMessage(message)) {
        logger.warn('Invalid message structure received:', message);
        return;
      }

      // Execute handlers for specific message type
      const specificHandlers = this.handlers.get(message.type) || [];
      const wildcardHandlers = this.handlers.get('*') || [];
      
      const allHandlers = [...specificHandlers, ...wildcardHandlers];

      for (const handler of allHandlers) {
        try {
          await handler(message);
        } catch (error) {
          logger.error(`Error in message handler for type ${message.type}:`, error);
        }
      }
    } catch (error) {
      logger.error('Failed to parse WebSocket message:', error);
      logger.debug('Raw message was:', rawMessage);
    }
  }

  private isValidMessage(message: any): message is TerminalMessage {
    if (!message || typeof message !== 'object') {
      return false;
    }

    // Check required fields
    if (!['input', 'output', 'resize', 'control'].includes(message.type)) {
      return false;
    }

    if (typeof message.timestamp !== 'number') {
      return false;
    }

    // Validate data based on message type
    switch (message.type) {
      case 'input':
      case 'output':
        return typeof message.data === 'string';
      
      case 'resize':
        return this.isValidResizeData(message.data);
      
      case 'control':
        return this.isValidControlData(message.data);
      
      default:
        return false;
    }
  }

  private isValidResizeData(data: any): data is ResizeData {
    return (
      data &&
      typeof data === 'object' &&
      typeof data.cols === 'number' &&
      typeof data.rows === 'number' &&
      data.cols > 0 &&
      data.rows > 0 &&
      data.cols <= 1000 &&
      data.rows <= 1000
    );
  }

  private isValidControlData(data: any): data is ControlData {
    return (
      data &&
      typeof data === 'object' &&
      ['SIGINT', 'SIGTERM', 'SIGKILL'].includes(data.signal)
    );
  }

  createMessage(type: TerminalMessage['type'], data: TerminalMessage['data']): TerminalMessage {
    return {
      type,
      data,
      timestamp: Date.now()
    };
  }

  serializeMessage(message: TerminalMessage): string {
    return JSON.stringify(message);
  }

  // Helper methods for creating specific message types
  createInputMessage(data: string): TerminalMessage {
    return this.createMessage('input', data);
  }

  createOutputMessage(data: string): TerminalMessage {
    return this.createMessage('output', data);
  }

  createResizeMessage(cols: number, rows: number): TerminalMessage {
    return this.createMessage('resize', { cols, rows });
  }

  createControlMessage(signal: ControlData['signal']): TerminalMessage {
    return this.createMessage('control', { signal });
  }
}
