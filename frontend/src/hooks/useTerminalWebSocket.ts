import { useState, useEffect, useRef, useCallback } from 'react';
import { TerminalWebSocketClient, TerminalWebSocketConfig, TerminalWebSocketCallbacks } from '../services/terminalWebSocket';

export interface UseTerminalWebSocketOptions {
  /**
   * WebSocket configuration options
   */
  config?: TerminalWebSocketConfig;
  
  /**
   * Whether to automatically connect when the hook mounts
   */
  autoConnect?: boolean;
  
  /**
   * Whether to automatically disconnect when the hook unmounts
   */
  autoDisconnect?: boolean;
}

export interface UseTerminalWebSocketReturn {
  /**
   * Whether the WebSocket is connected
   */
  isConnected: boolean;
  
  /**
   * Last error that occurred
   */
  error: Error | null;
  
  /**
   * Connect to the WebSocket
   */
  connect: () => void;
  
  /**
   * Disconnect from the WebSocket
   */
  disconnect: () => void;
  
  /**
   * Send terminal input (keyboard input from user)
   */
  sendInput: (data: string) => boolean;
  
  /**
   * Send terminal resize event
   */
  sendResize: (cols: number, rows: number) => boolean;
  
  /**
   * Send control signal
   */
  sendControlSignal: (signal: 'SIGINT' | 'SIGTERM' | 'SIGKILL' | 'SIGTSTP' | 'SIGCONT' | 'SIGQUIT') => boolean;
  
  /**
   * Clear error state
   */
  clearError: () => void;
  
  /**
   * Add a callback for terminal output
   */
  onOutput: (callback: (data: string) => void) => () => void;
  
  /**
   * Add a callback for connection events
   */
  onConnect: (callback: () => void) => () => void;
  
  /**
   * Add a callback for disconnection events
   */
  onDisconnect: (callback: () => void) => () => void;
  
  /**
   * Add a callback for errors
   */
  onError: (callback: (error: Error) => void) => () => void;
}

/**
 * React hook for managing terminal WebSocket connections
 */
export const useTerminalWebSocket = (
  sessionId: string | undefined,
  options: UseTerminalWebSocketOptions = {}
): UseTerminalWebSocketReturn => {
  const {
    config = {},
    autoConnect = true,
    autoDisconnect = true
  } = options;

  // State
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs
  const clientRef = useRef<TerminalWebSocketClient | null>(null);
  const outputCallbacksRef = useRef<Set<(data: string) => void>>(new Set());
  const connectCallbacksRef = useRef<Set<() => void>>(new Set());
  const disconnectCallbacksRef = useRef<Set<() => void>>(new Set());
  const errorCallbacksRef = useRef<Set<(error: Error) => void>>(new Set());

  // Initialize WebSocket client
  useEffect(() => {
    const callbacks: TerminalWebSocketCallbacks = {
      onOutput: (data: string) => {
        outputCallbacksRef.current.forEach(callback => {
          try {
            callback(data);
          } catch (err) {
            console.error('Error in terminal output callback:', err);
          }
        });
      },
      
      onConnect: () => {
        setIsConnected(true);
        setError(null);
        
        connectCallbacksRef.current.forEach(callback => {
          try {
            callback();
          } catch (err) {
            console.error('Error in terminal connect callback:', err);
          }
        });
      },
      
      onDisconnect: () => {
        setIsConnected(false);
        
        disconnectCallbacksRef.current.forEach(callback => {
          try {
            callback();
          } catch (err) {
            console.error('Error in terminal disconnect callback:', err);
          }
        });
      },
      
      onError: (err: Error) => {
        setError(err);
        
        errorCallbacksRef.current.forEach(callback => {
          try {
            callback(err);
          } catch (error) {
            console.error('Error in terminal error callback:', error);
          }
        });
      }
    };

    clientRef.current = new TerminalWebSocketClient(sessionId, config, callbacks);
    
    // Auto-connect if enabled (with small delay to prevent React StrictMode issues)
    if (autoConnect) {
      const timer = setTimeout(() => {
        clientRef.current?.connect();
      }, 50);
      
      return () => {
        clearTimeout(timer);
        if (clientRef.current && autoDisconnect) {
          clientRef.current.disconnect();
        }
        clientRef.current = null;
      };
    }

    // Cleanup on unmount
    return () => {
      if (clientRef.current && autoDisconnect) {
        clientRef.current.disconnect();
      }
      clientRef.current = null;
    };
  }, [sessionId, autoConnect, autoDisconnect]);

  // Callback functions
  const connect = useCallback(() => {
    clientRef.current?.connect();
  }, []);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
  }, []);

  const sendInput = useCallback((data: string): boolean => {
    if (!clientRef.current) {
      setError(new Error('Terminal WebSocket client not initialized'));
      return false;
    }
    return clientRef.current.sendInput(data);
  }, []);

  const sendResize = useCallback((cols: number, rows: number): boolean => {
    if (!clientRef.current) {
      setError(new Error('Terminal WebSocket client not initialized'));
      return false;
    }
    return clientRef.current.sendResize(cols, rows);
  }, []);

  const sendControlSignal = useCallback((signal: 'SIGINT' | 'SIGTERM' | 'SIGKILL' | 'SIGTSTP' | 'SIGCONT' | 'SIGQUIT'): boolean => {
    if (!clientRef.current) {
      setError(new Error('Terminal WebSocket client not initialized'));
      return false;
    }
    return clientRef.current.sendControlSignal(signal);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const onOutput = useCallback((callback: (data: string) => void) => {
    outputCallbacksRef.current.add(callback);
    
    // Return cleanup function
    return () => {
      outputCallbacksRef.current.delete(callback);
    };
  }, []);

  const onConnect = useCallback((callback: () => void) => {
    connectCallbacksRef.current.add(callback);
    
    // Return cleanup function
    return () => {
      connectCallbacksRef.current.delete(callback);
    };
  }, []);

  const onDisconnect = useCallback((callback: () => void) => {
    disconnectCallbacksRef.current.add(callback);
    
    // Return cleanup function
    return () => {
      disconnectCallbacksRef.current.delete(callback);
    };
  }, []);

  const onError = useCallback((callback: (error: Error) => void) => {
    errorCallbacksRef.current.add(callback);
    
    // Return cleanup function
    return () => {
      errorCallbacksRef.current.delete(callback);
    };
  }, []);

  return {
    isConnected,
    error,
    connect,
    disconnect,
    sendInput,
    sendResize,
    sendControlSignal,
    clearError,
    onOutput,
    onConnect,
    onDisconnect,
    onError
  };
};

export default useTerminalWebSocket;
