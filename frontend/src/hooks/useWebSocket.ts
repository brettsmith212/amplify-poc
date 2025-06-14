import { useState, useEffect, useCallback, useRef } from 'react';
import { WebSocketHookState, TerminalMessage } from '../types/terminal';

interface UseWebSocketOptions {
  onMessage?: (message: TerminalMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
}

export const useWebSocket = (
  url: string,
  options: UseWebSocketOptions = {}
) => {
  const {
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    reconnectAttempts = 5,
    reconnectInterval = 2000
  } = options;

  const [state, setState] = useState<WebSocketHookState>({
    socket: null,
    isConnected: false,
    error: null,
    reconnectAttempts: 0
  });

  const reconnectTimeoutRef = useRef<number>();
  const shouldReconnectRef = useRef(true);

  const connect = useCallback(() => {
    try {
      const socket = new WebSocket(url);

      socket.onopen = () => {
        setState(prev => ({
          ...prev,
          socket,
          isConnected: true,
          error: null,
          reconnectAttempts: 0
        }));
        onConnect?.();
      };

      socket.onmessage = (event) => {
        try {
          const message: TerminalMessage = JSON.parse(event.data);
          onMessage?.(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      socket.onclose = () => {
        setState(prev => ({
          ...prev,
          socket: null,
          isConnected: false
        }));
        onDisconnect?.();

        // Attempt reconnection if enabled and within limits
        if (shouldReconnectRef.current && state.reconnectAttempts < reconnectAttempts) {
          reconnectTimeoutRef.current = window.setTimeout(() => {
            setState(prev => ({
              ...prev,
              reconnectAttempts: prev.reconnectAttempts + 1
            }));
            connect();
          }, reconnectInterval);
        }
      };

      socket.onerror = (error) => {
        setState(prev => ({
          ...prev,
          error: 'WebSocket connection error'
        }));
        onError?.(error);
      };

    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to create WebSocket'
      }));
    }
  }, [url, onMessage, onConnect, onDisconnect, onError, reconnectAttempts, reconnectInterval]);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
    }
    if (state.socket) {
      state.socket.close();
    }
  }, [state.socket]);

  const sendMessage = useCallback((message: TerminalMessage) => {
    if (state.socket && state.isConnected) {
      state.socket.send(JSON.stringify(message));
    }
  }, [state.socket, state.isConnected]);

  useEffect(() => {
    connect();

    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      if (state.socket) {
        state.socket.close();
      }
    };
  }, [connect]);

  return {
    ...state,
    connect,
    disconnect,
    sendMessage
  };
};
