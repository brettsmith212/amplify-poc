import { ThreadMessage } from '../types/threadMessage';

// WebSocket message types matching backend interface
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
  data: ThreadMessage;
}

export interface ConnectionStatusEvent {
  type: 'connection_status';
  data: {
    status: 'connected' | 'disconnected' | 'error' | 'processing';
    message?: string;
    sessionId?: string;
  };
}

export interface ErrorEvent {
  type: 'error';
  data: {
    error: string;
    code?: string;
    timestamp?: string;
  };
}

export type ThreadWebSocketEvent = ThreadMessageEvent | ConnectionStatusEvent | ErrorEvent;

export enum ConnectionState {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
  CLOSED = 'closed'
}

export interface ThreadWebSocketConfig {
  /**
   * Base URL for WebSocket connections (e.g., 'ws://localhost:3001' or 'wss://api.example.com')
   */
  baseUrl?: string;
  
  /**
   * Maximum number of reconnection attempts
   */
  maxReconnectAttempts?: number;
  
  /**
   * Base delay between reconnection attempts in milliseconds
   */
  reconnectDelay?: number;
  
  /**
   * Maximum delay between reconnection attempts in milliseconds
   */
  maxReconnectDelay?: number;
  
  /**
   * Whether to automatically reconnect on connection loss
   */
  autoReconnect?: boolean;
  
  /**
   * Heartbeat interval in milliseconds
   */
  heartbeatInterval?: number;
  
  /**
   * Connection timeout in milliseconds
   */
  connectionTimeout?: number;
}

export interface ThreadWebSocketCallbacks {
  onMessage?: (message: ThreadMessage) => void;
  onConnectionChange?: (state: ConnectionState) => void;
  onError?: (error: Error) => void;
  onStatusUpdate?: (status: ConnectionStatusEvent['data']) => void;
}

/**
 * WebSocket client for thread communication with automatic reconnection
 */
export class ThreadWebSocketClient {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private config: Required<ThreadWebSocketConfig>;
  private callbacks: ThreadWebSocketCallbacks;
  
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private reconnectAttempts = 0;
  private reconnectTimeoutId: number | null = null;
  private heartbeatIntervalId: number | null = null;
  private connectionTimeoutId: number | null = null;
  private isManualClose = false;

  constructor(
    sessionId: string,
    config: ThreadWebSocketConfig = {},
    callbacks: ThreadWebSocketCallbacks = {}
  ) {
    this.sessionId = sessionId;
    this.config = {
      baseUrl: config.baseUrl || 'ws://localhost:3001',
      maxReconnectAttempts: config.maxReconnectAttempts || 5,
      reconnectDelay: config.reconnectDelay || 1000,
      maxReconnectDelay: config.maxReconnectDelay || 30000,
      autoReconnect: config.autoReconnect !== false,
      heartbeatInterval: config.heartbeatInterval || 30000,
      connectionTimeout: config.connectionTimeout || 10000
    };
    this.callbacks = callbacks;
  }

  /**
   * Connect to the WebSocket server
   */
  connect(): void {
    if (this.ws && this.connectionState === ConnectionState.CONNECTED) {
      return;
    }

    this.isManualClose = false;
    this.setConnectionState(ConnectionState.CONNECTING);
    
    try {
      const wsUrl = `${this.config.baseUrl}/ws/thread/${this.sessionId}`;
      this.ws = new WebSocket(wsUrl);
      
      // Set connection timeout
      this.connectionTimeoutId = window.setTimeout(() => {
        if (this.connectionState === ConnectionState.CONNECTING) {
          this.handleError(new Error('Connection timeout'));
          this.ws?.close();
        }
      }, this.config.connectionTimeout);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleWebSocketError.bind(this);
      
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error('Failed to create WebSocket connection'));
    }
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.isManualClose = true;
    this.clearTimers();
    
    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }
    
    this.setConnectionState(ConnectionState.DISCONNECTED);
  }

  /**
   * Send a user message
   */
  sendMessage(content: string): boolean {
    if (!this.isConnected()) {
      this.handleError(new Error('WebSocket is not connected'));
      return false;
    }

    try {
      const message: ThreadWebSocketMessage = {
        type: 'user_message',
        data: {
          content: content.trim(),
          sessionId: this.sessionId
        },
        timestamp: new Date().toISOString(),
        id: this.generateMessageId()
      };

      this.ws!.send(JSON.stringify(message));
      return true;
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error('Failed to send message'));
      return false;
    }
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.connectionState === ConnectionState.CONNECTED && 
           this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Update callbacks
   */
  updateCallbacks(newCallbacks: ThreadWebSocketCallbacks): void {
    this.callbacks = { ...this.callbacks, ...newCallbacks };
  }

  private handleOpen(): void {
    this.clearConnectionTimeout();
    this.reconnectAttempts = 0;
    this.setConnectionState(ConnectionState.CONNECTED);
    this.startHeartbeat();
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message: ThreadWebSocketMessage = JSON.parse(event.data);
      
      switch (message.type) {
        case 'thread_message':
          if (this.callbacks.onMessage && message.data) {
            this.callbacks.onMessage(message.data as ThreadMessage);
          }
          break;
          
        case 'connection_status':
          if (this.callbacks.onStatusUpdate && message.data) {
            this.callbacks.onStatusUpdate(message.data);
          }
          break;
          
        case 'error':
          if (message.data?.error) {
            this.handleError(new Error(message.data.error));
          }
          break;
          
        case 'ping':
          // Respond to ping with pong
          this.sendPong();
          break;
          
        case 'pong':
          // Pong received, connection is alive
          break;
          
        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      this.handleError(new Error('Failed to parse WebSocket message'));
    }
  }

  private handleClose(_event: CloseEvent): void {
    this.clearTimers();
    
    if (this.isManualClose) {
      this.setConnectionState(ConnectionState.CLOSED);
      return;
    }

    this.setConnectionState(ConnectionState.DISCONNECTED);
    
    if (this.config.autoReconnect && this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.scheduleReconnect();
    } else {
      this.setConnectionState(ConnectionState.ERROR);
      this.handleError(new Error(`Connection closed after ${this.reconnectAttempts} reconnection attempts`));
    }
  }

  private handleWebSocketError(): void {
    this.handleError(new Error('WebSocket connection error'));
  }

  private handleError(error: Error): void {
    console.error('ThreadWebSocket error:', error);
    
    if (this.callbacks.onError) {
      this.callbacks.onError(error);
    }
    
    if (this.connectionState !== ConnectionState.ERROR) {
      this.setConnectionState(ConnectionState.ERROR);
    }
  }

  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      
      if (this.callbacks.onConnectionChange) {
        this.callbacks.onConnectionChange(state);
      }
    }
  }

  private scheduleReconnect(): void {
    this.setConnectionState(ConnectionState.RECONNECTING);
    
    const delay = Math.min(
      this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.config.maxReconnectDelay
    );
    
    this.reconnectAttempts++;
    
    this.reconnectTimeoutId = window.setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startHeartbeat(): void {
    this.heartbeatIntervalId = window.setInterval(() => {
      if (this.isConnected()) {
        this.sendPing();
      }
    }, this.config.heartbeatInterval);
  }

  private sendPing(): void {
    if (this.isConnected()) {
      const message: ThreadWebSocketMessage = {
        type: 'ping',
        timestamp: new Date().toISOString()
      };
      this.ws!.send(JSON.stringify(message));
    }
  }

  private sendPong(): void {
    if (this.isConnected()) {
      const message: ThreadWebSocketMessage = {
        type: 'pong',
        timestamp: new Date().toISOString()
      };
      this.ws!.send(JSON.stringify(message));
    }
  }

  private clearTimers(): void {
    this.clearConnectionTimeout();
    this.clearReconnectTimeout();
    this.clearHeartbeat();
  }

  private clearConnectionTimeout(): void {
    if (this.connectionTimeoutId) {
      clearTimeout(this.connectionTimeoutId);
      this.connectionTimeoutId = null;
    }
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
  }

  private clearHeartbeat(): void {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default ThreadWebSocketClient;
