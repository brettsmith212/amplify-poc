import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { sessionStore } from '../services/sessionStore';
import { ampService } from '../services/ampService';
import { threadStorage } from '../services/threadStorage';
import { LogTailerWithParser, createLogTailerWithParser } from '../services/logTailerWithParser';
import { ThreadMessage, MessageType } from '../types/threadMessage';
import { LogLine } from '../services/logTailer';
import { logger } from '../utils/logger';
import { generateMessageId } from '../utils/logParsingUtils';

// WebSocket message types for thread communication
export interface ThreadWebSocketMessage {
  type: 'user_message' | 'thread_message' | 'connection_status' | 'error' | 'ping' | 'pong';
  data?: any;
  timestamp?: string;
  id?: string;
}

export interface UserMessageData {
  content: string;
  sessionId: string;
}

export interface ThreadMessageEvent {
  type: 'thread_message';
  data: {
    id: string;
    type: string;
    content: string;
    timestamp: string;
    metadata?: Record<string, any>;
  };
}

export interface ConnectionStatusEvent {
  type: 'connection_status';
  data: {
    status: 'connected' | 'disconnected' | 'error' | 'processing';
    message?: string;
    sessionId?: string;
  };
}

export interface ThreadWebSocketSession {
  id: string;
  sessionId: string;
  websocket: WebSocket;
  logTailer?: LogTailerWithParser;
  isActive: boolean;
  lastActivity: Date;
  messageCount: number;
}

export class ThreadWebSocketManager extends EventEmitter {
  private sessions: Map<string, ThreadWebSocketSession> = new Map();
  private sessionToWebSocket: Map<string, string> = new Map(); // sessionId -> websocketSessionId
  private pingInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.setupPeriodicTasks();
  }

  /**
   * Handle new WebSocket connection for thread communication
   */
  async handleConnection(ws: WebSocket, sessionId?: string, clientInfo?: any): Promise<string> {
    try {
      // Validate session exists
      if (!sessionId) {
        this.sendError(ws, 'Session ID is required');
        ws.close();
        throw new Error('Session ID is required for thread WebSocket connection');
      }

      const session = await sessionStore.getSession(sessionId);
      if (!session) {
        this.sendError(ws, `Session ${sessionId} not found`);
        ws.close();
        throw new Error(`Session ${sessionId} not found`);
      }

      // Create WebSocket session
      const wsSessionId = `thread_ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const threadSession: ThreadWebSocketSession = {
        id: wsSessionId,
        sessionId,
        websocket: ws,
        isActive: true,
        lastActivity: new Date(),
        messageCount: 0
      };

      // Store session mappings
      this.sessions.set(wsSessionId, threadSession);
      this.sessionToWebSocket.set(sessionId, wsSessionId);

      // Set up WebSocket event handlers
      this.setupWebSocketHandlers(threadSession);

      // Start log tailing if amp.log exists
      await this.startLogTailing(threadSession);

      // Send connection confirmation
      this.sendConnectionStatus(ws, 'connected', 'Thread WebSocket connected', sessionId);

      logger.info('Thread WebSocket connection established', {
        wsSessionId,
        sessionId,
        clientInfo
      });

      return wsSessionId;

    } catch (error) {
      logger.error('Failed to handle thread WebSocket connection', {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Set up WebSocket event handlers for a session
   */
  private setupWebSocketHandlers(threadSession: ThreadWebSocketSession): void {
    const { websocket, sessionId } = threadSession;

    websocket.on('message', async (data: WebSocket.Data) => {
      try {
        threadSession.lastActivity = new Date();
        threadSession.messageCount++;

        const message = JSON.parse(data.toString()) as ThreadWebSocketMessage;
        
        switch (message.type) {
          case 'user_message':
            await this.handleUserMessage(threadSession, message.data as UserMessageData);
            break;
            
          case 'ping':
            this.sendMessage(websocket, { type: 'pong', timestamp: new Date().toISOString() });
            break;
            
          default:
            logger.warn('Unknown thread WebSocket message type', {
              type: message.type,
              sessionId
            });
        }
      } catch (error) {
        logger.error('Error processing thread WebSocket message', {
          sessionId,
          error: error instanceof Error ? error.message : String(error)
        });
        this.sendError(websocket, 'Failed to process message');
      }
    });

    websocket.on('close', () => {
      this.handleDisconnection(threadSession);
    });

    websocket.on('error', (error) => {
      logger.error('Thread WebSocket error', {
        sessionId,
        error: error.message
      });
      this.handleDisconnection(threadSession);
    });
  }

  /**
   * Handle user message input and trigger amp command
   */
  private async handleUserMessage(threadSession: ThreadWebSocketSession, data: UserMessageData): Promise<void> {
    try {
      const { sessionId } = threadSession;
      const { content } = data;

      if (!content || !content.trim()) {
        this.sendError(threadSession.websocket, 'Message content is required');
        return;
      }

      // Update connection status to processing
      this.sendConnectionStatus(threadSession.websocket, 'processing', 'Processing message...');

      // Store user message in thread storage
      const userMessage: ThreadMessage = {
        id: generateMessageId(MessageType.USER, content.trim(), new Date()),
        type: MessageType.USER,
        content: content.trim(),
        timestamp: new Date()
      };

      await threadStorage.appendMessage(sessionId, userMessage);

      // Emit the user message immediately via WebSocket
      this.broadcastThreadMessage(sessionId, userMessage);

      // Execute amp continue command with the user input
      const session = await sessionStore.getSession(sessionId);
      if (!session || !session.threadId) {
        throw new Error('Session or thread ID not found');
      }

      // Use ampService to continue the thread with user input
      await ampService.continueThread(session.threadId, content.trim(), {
        workingDirectory: session.ampLogPath ? require('path').dirname(session.ampLogPath) : undefined
      });

      // Connection status will be updated when log messages start coming in
      
      logger.info('User message processed and amp command executed', {
        sessionId,
        threadId: session.threadId,
        messageLength: content.length
      });

    } catch (error) {
      logger.error('Failed to handle user message', {
        sessionId: threadSession.sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      this.sendError(threadSession.websocket, 'Failed to process message');
      this.sendConnectionStatus(threadSession.websocket, 'error', 'Failed to process message');
    }
  }

  /**
   * Start log tailing for a thread session
   */
  private async startLogTailing(threadSession: ThreadWebSocketSession): Promise<void> {
    try {
      const session = await sessionStore.getSession(threadSession.sessionId);
      if (!session || !session.ampLogPath) {
        logger.debug('No amp log path available for session', {
          sessionId: threadSession.sessionId
        });
        return;
      }

      // Create log tailer with parser
      threadSession.logTailer = createLogTailerWithParser(
        session.ampLogPath,
        threadSession.id,
        {
          onLogLine: (logLine: LogLine) => {
            // Optional: forward raw log lines for debugging
            // this.sendMessage(threadSession.websocket, {
            //   type: 'log_line',
            //   data: logLine
            // });
          },
          onThreadMessage: (message: ThreadMessage) => {
            // Handle parsed thread messages
            this.handleParsedMessage(threadSession, message);
          }
        }
      );

      // Set up log tailer event handlers
      threadSession.logTailer.on('error', (error) => {
        logger.error('Log tailer error', {
          sessionId: threadSession.sessionId,
          error: error instanceof Error ? error.message : String(error)
        });
      });

      threadSession.logTailer.on('started', () => {
        logger.debug('Log tailer started for thread session', {
          sessionId: threadSession.sessionId
        });
      });

      // Start the log tailer
      await threadSession.logTailer.start();

    } catch (error) {
      logger.error('Failed to start log tailing', {
        sessionId: threadSession.sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Handle parsed thread message from log tailer
   */
  private async handleParsedMessage(threadSession: ThreadWebSocketSession, message: ThreadMessage): Promise<void> {
    try {
      // Store message in thread storage
      await threadStorage.appendMessage(threadSession.sessionId, message);

      // Broadcast to all WebSocket clients for this session
      this.broadcastThreadMessage(threadSession.sessionId, message);

      // Update connection status based on message type
      if (message.type === MessageType.ASSISTANT && !message.metadata?.type) {
        // Main assistant response completed
        this.sendConnectionStatus(threadSession.websocket, 'connected', 'Ready for next message');
      }

    } catch (error) {
      logger.error('Failed to handle parsed message', {
        sessionId: threadSession.sessionId,
        messageId: message.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Broadcast thread message to all WebSocket clients for a session
   */
  private broadcastThreadMessage(sessionId: string, message: ThreadMessage): void {
    const wsSessionId = this.sessionToWebSocket.get(sessionId);
    if (!wsSessionId) {
      return;
    }

    const threadSession = this.sessions.get(wsSessionId);
    if (!threadSession || !threadSession.isActive) {
      return;
    }

    const threadMessageEvent: ThreadMessageEvent = {
      type: 'thread_message',
      data: {
        id: message.id,
        type: message.type,
        content: message.content,
        timestamp: message.timestamp.toISOString(),
        ...(message.metadata && { metadata: message.metadata })
      }
    };

    this.sendMessage(threadSession.websocket, threadMessageEvent);
  }

  /**
   * Handle WebSocket disconnection
   */
  private handleDisconnection(threadSession: ThreadWebSocketSession): void {
    try {
      threadSession.isActive = false;

      // Stop log tailer
      if (threadSession.logTailer) {
        threadSession.logTailer.stop();
      }

      // Remove from mappings
      this.sessions.delete(threadSession.id);
      this.sessionToWebSocket.delete(threadSession.sessionId);

      logger.info('Thread WebSocket disconnected', {
        wsSessionId: threadSession.id,
        sessionId: threadSession.sessionId,
        messageCount: threadSession.messageCount,
        duration: Date.now() - threadSession.lastActivity.getTime()
      });

    } catch (error) {
      logger.error('Error handling thread WebSocket disconnection', {
        sessionId: threadSession.sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Send message to WebSocket client
   */
  private sendMessage(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        logger.error('Failed to send WebSocket message', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Send error message to WebSocket client
   */
  private sendError(ws: WebSocket, message: string): void {
    this.sendMessage(ws, {
      type: 'error',
      data: { message },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send connection status to WebSocket client
   */
  private sendConnectionStatus(ws: WebSocket, status: 'connected' | 'disconnected' | 'error' | 'processing', message?: string, sessionId?: string): void {
    const statusEvent: ConnectionStatusEvent = {
      type: 'connection_status',
      data: { 
        status,
        ...(message && { message }),
        ...(sessionId && { sessionId })
      }
    };
    this.sendMessage(ws, statusEvent);
  }

  /**
   * Ping all active sessions
   */
  pingAllSessions(): void {
    const now = new Date();
    for (const [wsSessionId, threadSession] of this.sessions) {
      if (threadSession.isActive && threadSession.websocket.readyState === WebSocket.OPEN) {
        // Check if session is stale (no activity for 30 minutes)
        const inactiveMs = now.getTime() - threadSession.lastActivity.getTime();
        if (inactiveMs > 30 * 60 * 1000) {
          logger.info('Closing stale thread WebSocket session', { wsSessionId });
          threadSession.websocket.close();
          continue;
        }

        // Send ping
        this.sendMessage(threadSession.websocket, {
          type: 'ping',
          timestamp: now.toISOString()
        });
      }
    }
  }

  /**
   * Get session statistics
   */
  getStats(): { activeConnections: number; totalSessions: number; sessionsWithLogTailers: number } {
    const activeSessions = Array.from(this.sessions.values()).filter(s => s.isActive);
    const sessionsWithLogTailers = activeSessions.filter(s => s.logTailer).length;

    return {
      activeConnections: activeSessions.length,
      totalSessions: this.sessions.size,
      sessionsWithLogTailers
    };
  }

  /**
   * Clean up inactive sessions
   */
  private cleanup(): void {
    const now = new Date();
    const staleSessionIds: string[] = [];

    for (const [wsSessionId, threadSession] of this.sessions) {
      const inactiveMs = now.getTime() - threadSession.lastActivity.getTime();
      
      // Mark sessions as stale if inactive for more than 1 hour
      if (inactiveMs > 60 * 60 * 1000 || threadSession.websocket.readyState !== WebSocket.OPEN) {
        staleSessionIds.push(wsSessionId);
      }
    }

    // Clean up stale sessions
    for (const wsSessionId of staleSessionIds) {
      const threadSession = this.sessions.get(wsSessionId);
      if (threadSession) {
        this.handleDisconnection(threadSession);
      }
    }

    if (staleSessionIds.length > 0) {
      logger.debug('Cleaned up stale thread WebSocket sessions', {
        count: staleSessionIds.length
      });
    }
  }

  /**
   * Set up periodic tasks
   */
  private setupPeriodicTasks(): void {
    // Ping every 30 seconds
    this.pingInterval = setInterval(() => {
      this.pingAllSessions();
    }, 30000);

    // Cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Shutdown the manager
   */
  shutdown(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Close all active sessions
    for (const threadSession of this.sessions.values()) {
      this.handleDisconnection(threadSession);
      if (threadSession.websocket.readyState === WebSocket.OPEN) {
        threadSession.websocket.close();
      }
    }

    this.sessions.clear();
    this.sessionToWebSocket.clear();
  }
}

// Export singleton instance
export const threadWebSocketManager = new ThreadWebSocketManager();
