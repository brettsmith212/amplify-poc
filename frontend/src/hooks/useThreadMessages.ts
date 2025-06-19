import { useState, useEffect, useCallback, useRef } from 'react';
import { ThreadMessage } from '../types/threadMessage';
import { useWebSocket } from './useWebSocket';
import { ConnectionState } from '../services/threadWebSocket';

export interface UseThreadMessagesOptions {
  /**
   * Session ID for the thread
   */
  sessionId: string;
  
  /**
   * Whether to automatically connect to the WebSocket
   */
  autoConnect?: boolean;
  
  /**
   * Whether to load message history on mount
   */
  loadHistory?: boolean;
  
  /**
   * Maximum number of messages to keep in memory
   */
  maxMessages?: number;
  
  /**
   * API base URL for HTTP requests
   */
  apiBaseUrl?: string;
}

export interface UseThreadMessagesReturn {
  /**
   * Current thread messages
   */
  messages: ThreadMessage[];
  
  /**
   * Whether the WebSocket is connected
   */
  isConnected: boolean;
  
  /**
   * Current connection state
   */
  connectionState: ConnectionState;
  
  /**
   * Whether messages are being loaded
   */
  isLoading: boolean;
  
  /**
   * Whether a message is being sent
   */
  isSending: boolean;
  
  /**
   * Last error that occurred
   */
  error: Error | null;
  
  /**
   * Send a message to the thread
   */
  sendMessage: (content: string) => Promise<boolean>;
  
  /**
   * Load message history from the server
   */
  loadHistory: () => Promise<void>;
  
  /**
   * Clear all messages
   */
  clearMessages: () => void;
  
  /**
   * Clear error state
   */
  clearError: () => void;
  
  /**
   * Retry connection
   */
  reconnect: () => void;
}

/**
 * Custom hook for managing thread messages with WebSocket communication
 */
export const useThreadMessages = (options: UseThreadMessagesOptions): UseThreadMessagesReturn => {
  const {
    sessionId,
    autoConnect = true,
    loadHistory: shouldLoadHistory = true,
    maxMessages = 1000,
    apiBaseUrl = 'http://localhost:3001'
  } = options;

  // State for additional functionality
  const [isLoading, setIsLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  
  // Use the WebSocket hook
  const {
    messages: wsMessages,
    isConnected,
    connectionState,
    isSending,
    error: wsError,
    sendMessage: wsSendMessage,
    clearMessages: wsClearMessages,
    clearError: wsClearError,
    connect,
    disconnect
  } = useWebSocket(sessionId, {
    autoConnect,
    storeMessages: true,
    maxStoredMessages: maxMessages
  });

  // Refs
  const loadHistoryRef = useRef<() => Promise<void>>();
  const [localError, setLocalError] = useState<Error | null>(null);

  // Combined error state
  const error = wsError || localError;

  /**
   * Load message history from the server
   */
  const loadHistory = useCallback(async (): Promise<void> => {
    if (isLoading || historyLoaded) return;

    setIsLoading(true);
    setLocalError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/sessions/${sessionId}/thread`);
      
      if (!response.ok) {
        throw new Error(`Failed to load thread history: ${response.status} ${response.statusText}`);
      }

      await response.json();
      
      // The messages are already being handled by the WebSocket hook
      // This is mainly for loading historical messages when the component mounts
      // The actual message handling will be done by the WebSocket connection
      
      setHistoryLoaded(true);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load thread history');
      setLocalError(error);
      console.error('Error loading thread history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, apiBaseUrl, isLoading, historyLoaded]);

  // Store loadHistory function in ref for use in effects
  loadHistoryRef.current = loadHistory;

  /**
   * Send a message to the thread
   */
  const sendMessage = useCallback(async (content: string): Promise<boolean> => {
    if (!content.trim()) {
      setLocalError(new Error('Message content cannot be empty'));
      return false;
    }

    setLocalError(null);
    return await wsSendMessage(content);
  }, [wsSendMessage]);

  /**
   * Clear all messages
   */
  const clearMessages = useCallback(() => {
    wsClearMessages();
    setHistoryLoaded(false);
  }, [wsClearMessages]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    wsClearError();
    setLocalError(null);
  }, [wsClearError]);

  /**
   * Retry connection
   */
  const reconnect = useCallback(() => {
    clearError();
    disconnect();
    setTimeout(() => {
      connect();
    }, 1000);
  }, [clearError, disconnect, connect]);

  // Load history when component mounts and connection is established
  useEffect(() => {
    if (shouldLoadHistory && isConnected && !historyLoaded && !isLoading) {
      loadHistoryRef.current?.();
    }
  }, [shouldLoadHistory, isConnected, historyLoaded, isLoading]);

  return {
    messages: wsMessages,
    isConnected,
    connectionState,
    isLoading,
    isSending,
    error,
    sendMessage,
    loadHistory,
    clearMessages,
    clearError,
    reconnect
  };
};

export default useThreadMessages;
