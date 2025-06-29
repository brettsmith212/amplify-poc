import { useState, useCallback, useRef, useEffect } from 'react';
import { ThreadMessage } from '../types/threadMessage';

export interface UseThreadHistoryOptions {
  /**
   * Session ID for the thread
   */
  sessionId: string;
  
  /**
   * Whether to automatically load history on mount
   */
  autoLoad?: boolean;
  
  /**
   * Number of messages to load per request
   */
  pageSize?: number;
  
  /**
   * API base URL for HTTP requests
   */
  apiBaseUrl?: string;
}

export interface ThreadHistoryResponse {
  messages: ThreadMessage[];
  hasMore: boolean;
  total: number;
  nextCursor?: string;
  prevCursor?: string;
}

export interface UseThreadHistoryReturn {
  /**
   * All loaded messages
   */
  messages: ThreadMessage[];
  
  /**
   * Whether we're currently loading
   */
  isLoading: boolean;
  
  /**
   * Whether there are more messages to load
   */
  hasMore: boolean;
  
  /**
   * Total number of messages available
   */
  totalCount: number;
  
  /**
   * Any error that occurred during loading
   */
  error: Error | null;
  
  /**
   * Load the initial set of messages
   */
  loadHistory: () => Promise<void>;
  
  /**
   * Load more messages (pagination)
   */
  loadMoreMessages: () => Promise<void>;
  
  /**
   * Refresh the current page of messages
   */
  refreshHistory: () => Promise<void>;
  
  /**
   * Clear all loaded messages and reset state
   */
  clearHistory: () => void;
  
  /**
   * Add new messages to the history (e.g., from real-time updates)
   */
  addMessages: (newMessages: ThreadMessage[]) => void;
  
  /**
   * Add a single message to the history
   */
  addMessage: (message: ThreadMessage) => void;
}

/**
 * Custom hook for managing thread message history
 * 
 * This hook handles loading and managing historical thread messages
 * separate from real-time WebSocket updates. It provides pagination
 * support and integrates with the existing message system.
 */
export const useThreadHistory = (options: UseThreadHistoryOptions): UseThreadHistoryReturn => {
  const {
    sessionId,
    autoLoad = false,
    pageSize = 50,
    apiBaseUrl = 'http://localhost:3000'
  } = options;
  
  // State
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Refs
  const loadingRef = useRef(false);
  
  /**
   * Convert API response to ThreadMessage format
   */
  const convertApiMessage = useCallback((apiMessage: any): ThreadMessage => {
    return {
      id: apiMessage.id,
      role: apiMessage.type === 'user_input' ? 'user' : 
            apiMessage.type === 'system' ? 'system' : 'amp',
      content: apiMessage.content,
      ts: apiMessage.timestamp,
      metadata: apiMessage.metadata || {}
    };
  }, []);
  
  /**
   * Load messages from the API
   */
  const loadMessages = useCallback(async (
    cursor?: string,
    _isRefresh = false
  ): Promise<ThreadHistoryResponse> => {
    if (loadingRef.current) {
      throw new Error('Already loading');
    }
    
    loadingRef.current = true;
    setError(null);
    
    try {
      const params = new URLSearchParams();
      params.append('limit', pageSize.toString());
      
      if (cursor) {
        params.append('after', cursor);
      }
      
      const url = `${apiBaseUrl}/api/sessions/${sessionId}/thread?${params.toString()}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to load thread history: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Convert API messages to ThreadMessage format
      const convertedMessages = data.messages.map(convertApiMessage);
      
      return {
        messages: convertedMessages,
        hasMore: data.hasMore,
        total: data.total,
        nextCursor: data.nextCursor,
        prevCursor: data.prevCursor
      };
    } finally {
      loadingRef.current = false;
    }
  }, [sessionId, pageSize, apiBaseUrl, convertApiMessage]);
  
  /**
   * Load the initial set of messages
   */
  const loadHistory = useCallback(async (): Promise<void> => {
    if (isLoading || !sessionId) return;
    
    setIsLoading(true);
    
    try {
      const result = await loadMessages();
      
      setMessages(result.messages);
      setHasMore(result.hasMore);
      setTotalCount(result.total);
      setNextCursor(result.nextCursor);
      setIsInitialLoad(false);
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to load thread history');
      setError(errorObj);
      console.error('Error loading thread history:', errorObj);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, sessionId, loadMessages]);
  
  /**
   * Load more messages (pagination)
   */
  const loadMoreMessages = useCallback(async (): Promise<void> => {
    if (isLoading || !hasMore || !nextCursor || !sessionId) return;
    
    setIsLoading(true);
    
    try {
      const result = await loadMessages(nextCursor);
      
      setMessages(prev => [...prev, ...result.messages]);
      setHasMore(result.hasMore);
      setTotalCount(result.total);
      setNextCursor(result.nextCursor);
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to load more messages');
      setError(errorObj);
      console.error('Error loading more messages:', errorObj);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, hasMore, nextCursor, sessionId, loadMessages]);
  
  /**
   * Refresh the current page of messages
   */
  const refreshHistory = useCallback(async (): Promise<void> => {
    if (isLoading || !sessionId) return;
    
    setIsLoading(true);
    
    try {
      const result = await loadMessages(undefined, true);
      
      setMessages(result.messages);
      setHasMore(result.hasMore);
      setTotalCount(result.total);
      setNextCursor(result.nextCursor);
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to refresh thread history');
      setError(errorObj);
      console.error('Error refreshing thread history:', errorObj);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, sessionId, loadMessages]);
  
  /**
   * Clear all loaded messages and reset state
   */
  const clearHistory = useCallback(() => {
    setMessages([]);
    setHasMore(true);
    setTotalCount(0);
    setNextCursor(undefined);
    setError(null);
    setIsInitialLoad(true);
  }, []);
  
  /**
   * Add new messages to the history (e.g., from real-time updates)
   */
  const addMessages = useCallback((newMessages: ThreadMessage[]) => {
    if (newMessages.length === 0) return;
    
    setMessages(prev => {
      // Filter out any duplicates by ID
      const existingIds = new Set(prev.map(msg => msg.id));
      const uniqueNewMessages = newMessages.filter(msg => !existingIds.has(msg.id));
      
      if (uniqueNewMessages.length === 0) return prev;
      
      // Add new messages and sort by timestamp
      const combined = [...prev, ...uniqueNewMessages];
      return combined.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    });
    
    // Update total count
    setTotalCount(prev => prev + newMessages.length);
  }, []);
  
  /**
   * Add a single message to the history
   */
  const addMessage = useCallback((message: ThreadMessage) => {
    addMessages([message]);
  }, [addMessages]);
  
  // Auto-load history on mount if enabled
  useEffect(() => {
    if (autoLoad && sessionId && isInitialLoad && !isLoading && !loadingRef.current) {
      loadHistory();
    }
  }, [autoLoad, sessionId, isInitialLoad, isLoading, loadHistory]);
  
  return {
    messages,
    isLoading,
    hasMore,
    totalCount,
    error,
    loadHistory,
    loadMoreMessages,
    refreshHistory,
    clearHistory,
    addMessages,
    addMessage
  };
};

export default useThreadHistory;
