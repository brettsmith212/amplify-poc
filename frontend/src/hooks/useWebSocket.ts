import { useState, useEffect, useRef, useCallback } from 'react';
import { ThreadWebSocketClient, ConnectionState, ThreadWebSocketConfig, ThreadWebSocketCallbacks } from '../services/threadWebSocket';
import { ThreadMessage } from '../types/threadMessage';

export interface UseWebSocketOptions {
  /**
   * WebSocket configuration options
   */
  config?: ThreadWebSocketConfig;
  
  /**
   * Whether to automatically connect when the hook mounts
   */
  autoConnect?: boolean;
  
  /**
   * Whether to automatically disconnect when the hook unmounts
   */
  autoDisconnect?: boolean;
  
  /**
   * Whether to store messages in the hook state
   */
  storeMessages?: boolean;
  
  /**
   * Maximum number of messages to store (if storeMessages is true)
   */
  maxStoredMessages?: number;
}

export interface UseWebSocketReturn {
  /**
   * Current connection state
   */
  connectionState: ConnectionState;
  
  /**
   * Whether the WebSocket is connected
   */
  isConnected: boolean;
  
  /**
   * Messages received from the WebSocket (if storeMessages is enabled)
   */
  messages: ThreadMessage[];
  
  /**
   * Last error that occurred
   */
  error: Error | null;
  
  /**
   * Whether a message is currently being sent
   */
  isSending: boolean;
  
  /**
   * Connect to the WebSocket
   */
  connect: () => void;
  
  /**
   * Disconnect from the WebSocket
   */
  disconnect: () => void;
  
  /**
   * Send a message through the WebSocket
   */
  sendMessage: (content: string) => Promise<boolean>;
  
  /**
   * Clear stored messages
   */
  clearMessages: () => void;
  
  /**
   * Clear error state
   */
  clearError: () => void;
  
  /**
   * Add a callback for message events
   */
  onMessage: (callback: (message: ThreadMessage) => void) => void;
  
  /**
   * Add a callback for connection state changes
   */
  onConnectionChange: (callback: (state: ConnectionState) => void) => void;
  
  /**
   * Add a callback for errors
   */
  onError: (callback: (error: Error) => void) => void;
}

/**
 * React hook for managing WebSocket connections to thread endpoints
 */
export const useWebSocket = (
  sessionId: string,
  options: UseWebSocketOptions = {}
): UseWebSocketReturn => {
  const {
    config = {},
    autoConnect = true,
    autoDisconnect = true,
    storeMessages = true,
    maxStoredMessages = 1000
  } = options;

  // State
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Refs
  const clientRef = useRef<ThreadWebSocketClient | null>(null);
  const messageCallbacksRef = useRef<Set<(message: ThreadMessage) => void>>(new Set());
  const connectionCallbacksRef = useRef<Set<(state: ConnectionState) => void>>(new Set());
  const errorCallbacksRef = useRef<Set<(error: Error) => void>>(new Set());

  // Initialize WebSocket client
  useEffect(() => {
    const callbacks: ThreadWebSocketCallbacks = {
      onMessage: (message: ThreadMessage) => {
        // Store message if enabled
        if (storeMessages) {
          setMessages(prev => {
            const newMessages = [...prev, message];
            // Limit stored messages
            if (newMessages.length > maxStoredMessages) {
              return newMessages.slice(-maxStoredMessages);
            }
            return newMessages;
          });
        }
        
        // Call registered callbacks
        messageCallbacksRef.current.forEach(callback => {
          try {
            callback(message);
          } catch (err) {
            console.error('Error in message callback:', err);
          }
        });
      },
      
      onConnectionChange: (state: ConnectionState) => {
        setConnectionState(state);
        
        // Clear error when successfully connected
        if (state === ConnectionState.CONNECTED) {
          setError(null);
        }
        
        // Call registered callbacks
        connectionCallbacksRef.current.forEach(callback => {
          try {
            callback(state);
          } catch (err) {
            console.error('Error in connection callback:', err);
          }
        });
      },
      
      onError: (err: Error) => {
        setError(err);
        
        // Call registered callbacks
        errorCallbacksRef.current.forEach(callback => {
          try {
            callback(err);
          } catch (error) {
            console.error('Error in error callback:', error);
          }
        });
      }
    };

    clientRef.current = new ThreadWebSocketClient(sessionId, config, callbacks);
    
    // Auto-connect if enabled
    if (autoConnect) {
      clientRef.current.connect();
    }

    // Cleanup on unmount
    return () => {
      if (clientRef.current && autoDisconnect) {
        clientRef.current.disconnect();
      }
      clientRef.current = null;
    };
  }, [sessionId, autoConnect, autoDisconnect, storeMessages, maxStoredMessages]);

  // Update client callbacks when config changes
  useEffect(() => {
    if (clientRef.current) {
      const callbacks: ThreadWebSocketCallbacks = {
        onMessage: (message: ThreadMessage) => {
          if (storeMessages) {
            setMessages(prev => {
              const newMessages = [...prev, message];
              if (newMessages.length > maxStoredMessages) {
                return newMessages.slice(-maxStoredMessages);
              }
              return newMessages;
            });
          }
          
          messageCallbacksRef.current.forEach(callback => {
            try {
              callback(message);
            } catch (err) {
              console.error('Error in message callback:', err);
            }
          });
        },
        
        onConnectionChange: (state: ConnectionState) => {
          setConnectionState(state);
          
          if (state === ConnectionState.CONNECTED) {
            setError(null);
          }
          
          connectionCallbacksRef.current.forEach(callback => {
            try {
              callback(state);
            } catch (err) {
              console.error('Error in connection callback:', err);
            }
          });
        },
        
        onError: (err: Error) => {
          setError(err);
          
          errorCallbacksRef.current.forEach(callback => {
            try {
              callback(err);
            } catch (error) {
              console.error('Error in error callback:', error);
            }
          });
        }
      };
      
      clientRef.current.updateCallbacks(callbacks);
    }
  }, [storeMessages, maxStoredMessages]);

  // Callback functions
  const connect = useCallback(() => {
    clientRef.current?.connect();
  }, []);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
  }, []);

  const sendMessage = useCallback(async (content: string): Promise<boolean> => {
    if (!clientRef.current) {
      setError(new Error('WebSocket client not initialized'));
      return false;
    }

    setIsSending(true);
    
    try {
      const success = clientRef.current.sendMessage(content);
      return success;
    } finally {
      setIsSending(false);
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const onMessage = useCallback((callback: (message: ThreadMessage) => void) => {
    messageCallbacksRef.current.add(callback);
    
    // Return cleanup function
    return () => {
      messageCallbacksRef.current.delete(callback);
    };
  }, []);

  const onConnectionChange = useCallback((callback: (state: ConnectionState) => void) => {
    connectionCallbacksRef.current.add(callback);
    
    // Return cleanup function
    return () => {
      connectionCallbacksRef.current.delete(callback);
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
    connectionState,
    isConnected: connectionState === ConnectionState.CONNECTED,
    messages,
    error,
    isSending,
    connect,
    disconnect,
    sendMessage,
    clearMessages,
    clearError,
    onMessage,
    onConnectionChange,
    onError
  };
};

export default useWebSocket;
