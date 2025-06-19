import { TerminalMessage } from '../types/terminal';

export interface TerminalWebSocketConfig {
  /**
   * Base URL for WebSocket connections
   */
  baseUrl?: string;
  
  /**
   * Whether to automatically reconnect on connection loss
   */
  autoReconnect?: boolean;
  
  /**
   * Maximum number of reconnection attempts
   */
  maxReconnectAttempts?: number;
  
  /**
   * Base delay between reconnection attempts in milliseconds
   */
  reconnectDelay?: number;
}

export interface TerminalWebSocketCallbacks {
  onOutput?: (data: string) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

/**
 * WebSocket client specifically for terminal communication
 * Matches the backend terminalBridge.ts protocol
 */
export class TerminalWebSocketClient {
  private ws: WebSocket | null = null;
  private sessionId: string | undefined;
  private config: Required<TerminalWebSocketConfig>;
  private callbacks: TerminalWebSocketCallbacks;
  private isConnected = false;
  private reconnectAttempts = 0;
  private reconnectTimeoutId: number | null = null;

  constructor(
    sessionId: string | undefined,
    config: TerminalWebSocketConfig = {},
    callbacks: TerminalWebSocketCallbacks = {}
  ) {
    this.sessionId = sessionId;
    this.config = {
      baseUrl: config.baseUrl || 'ws://localhost:3000',
      autoReconnect: config.autoReconnect !== false,
      maxReconnectAttempts: config.maxReconnectAttempts || 3,
      reconnectDelay: config.reconnectDelay || 1000
    };
    this.callbacks = callbacks;
  }

  /**
   * Connect to the terminal WebSocket
   */
  connect(): void {
    if (this.ws && this.isConnected) {
      return;
    }

    try {
      // Build WebSocket URL - matches backend routing
      const wsUrl = this.sessionId 
        ? `${this.config.baseUrl}/ws/${this.sessionId}`
        : `${this.config.baseUrl}/ws`;
      
      console.log('Connecting to terminal WebSocket:', wsUrl);
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      
    } catch (error) {
      this.handleError(new ErrorEvent('connection', { 
        error: error instanceof Error ? error : new Error('Failed to create WebSocket connection')
      }));
    }
  }

  /**
   * Disconnect from the terminal WebSocket
   */
  disconnect(): void {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    
    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }
    
    this.isConnected = false;
  }

  /**
   * Send terminal input (keyboard input from user)
   */
  sendInput(data: string): boolean {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('Terminal WebSocket not connected');
      return false;
    }

    try {
      const message: TerminalMessage = {
        type: 'input',
        data,
        timestamp: Date.now()
      };

      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Failed to send terminal input:', error);
      return false;
    }
  }

  /**
   * Send terminal resize event
   */
  sendResize(cols: number, rows: number): boolean {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Don't log warning for resize events during connection - this is normal
      return false;
    }

    try {
      const message: TerminalMessage = {
        type: 'resize',
        data: { cols, rows },
        timestamp: Date.now()
      };

      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Failed to send terminal resize:', error);
      return false;
    }
  }

  /**
   * Send control signal (like Ctrl+C)
   */
  sendControlSignal(signal: 'SIGINT' | 'SIGTERM' | 'SIGKILL' | 'SIGTSTP' | 'SIGCONT' | 'SIGQUIT'): boolean {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('Terminal WebSocket not connected');
      return false;
    }

    try {
      const message: TerminalMessage = {
        type: 'control',
        data: { signal },
        timestamp: Date.now()
      };

      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Failed to send control signal:', error);
      return false;
    }
  }

  /**
   * Check if WebSocket is connected
   */
  getIsConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Update callbacks
   */
  updateCallbacks(newCallbacks: TerminalWebSocketCallbacks): void {
    this.callbacks = { ...this.callbacks, ...newCallbacks };
  }

  private handleOpen(): void {
    console.log('Terminal WebSocket connected');
    this.isConnected = true;
    this.reconnectAttempts = 0;
    
    if (this.callbacks.onConnect) {
      this.callbacks.onConnect();
    }
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message: TerminalMessage = JSON.parse(event.data);
      
      // Handle output messages from backend
      if (message.type === 'output' && typeof message.data === 'string') {
        if (this.callbacks.onOutput) {
          this.callbacks.onOutput(message.data);
        }
      }
    } catch (error) {
      console.error('Failed to parse terminal WebSocket message:', error);
    }
  }

  private handleClose(event: CloseEvent): void {
    console.log('Terminal WebSocket closed:', event.code, event.reason);
    this.isConnected = false;
    
    if (this.callbacks.onDisconnect) {
      this.callbacks.onDisconnect();
    }

    // Auto-reconnect if enabled and not a manual close
    if (this.config.autoReconnect && 
        event.code !== 1000 && 
        this.reconnectAttempts < this.config.maxReconnectAttempts) {
      
      this.scheduleReconnect();
    }
  }

  private handleError(event: Event): void {
    const error = event instanceof ErrorEvent 
      ? (event.error || new Error(event.message || 'WebSocket error'))
      : new Error('Terminal WebSocket error');
      
    console.error('Terminal WebSocket error:', error);
    
    if (this.callbacks.onError) {
      this.callbacks.onError(error);
    }
  }

  private scheduleReconnect(): void {
    const delay = this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;
    
    console.log(`Reconnecting terminal WebSocket in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimeoutId = window.setTimeout(() => {
      this.connect();
    }, delay);
  }
}

export default TerminalWebSocketClient;
