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
  
  // Store callbacks in refs to prevent recreating connect function
  const onMessageRef = useRef(onMessage);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  const onErrorRef = useRef(onError);

  // Update refs when callbacks change
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    onConnectRef.current = onConnect;
  }, [onConnect]);

  useEffect(() => {
    onDisconnectRef.current = onDisconnect;
  }, [onDisconnect]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

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
        onConnectRef.current?.();
      };

      socket.onmessage = (event) => {
        try {
          const message: TerminalMessage = JSON.parse(event.data);
          onMessageRef.current?.(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      socket.onclose = () => {
        setState(prev => {
          const newState = {
            ...prev,
            socket: null,
            isConnected: false
          };
          
          onDisconnectRef.current?.();

          // Attempt reconnection if enabled and within limits
          if (shouldReconnectRef.current && prev.reconnectAttempts < reconnectAttempts) {
            reconnectTimeoutRef.current = window.setTimeout(() => {
              setState(prevInner => ({
                ...prevInner,
                reconnectAttempts: prevInner.reconnectAttempts + 1
              }));
              connect();
            }, reconnectInterval);
          }
          
          return newState;
        });
      };

      socket.onerror = (error) => {
        setState(prev => ({
          ...prev,
          error: 'WebSocket connection error'
        }));
        onErrorRef.current?.(error);
      };

    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to create WebSocket'
      }));
    }
  }, [url, reconnectAttempts, reconnectInterval]);

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
