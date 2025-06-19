import React, { useRef, useEffect, useCallback } from 'react';
import { useTerminal } from '../hooks/useTerminal';
import { useTerminalWebSocket } from '../hooks/useTerminalWebSocket';
import { TerminalProps } from '../types/terminal';
import '@xterm/xterm/css/xterm.css';

const Terminal: React.FC<TerminalProps> = ({
  className = '',
  sessionId,
  onReady,
  onData,
  onResize
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);

  // Create refs for terminal functions that will be available later
  const writeRef = useRef<((data: string) => void) | null>(null);
  const writelnRef = useRef<((data: string) => void) | null>(null);

  // Terminal WebSocket connection
  const {
    isConnected,
    error,
    sendInput,
    sendResize,
    sendControlSignal,
    onOutput,
    onConnect,
    onDisconnect,
    onError
  } = useTerminalWebSocket(sessionId, {
    config: {
      baseUrl: 'ws://localhost:3000',
      autoReconnect: true,
      maxReconnectAttempts: 3,
      reconnectDelay: 1000
    },
    autoConnect: true,
    autoDisconnect: true
  });

  // Set up WebSocket event handlers
  useEffect(() => {
    const unsubscribeOutput = onOutput((data: string) => {
      if (writeRef.current) {
        writeRef.current(data);
      }
    });

    const unsubscribeConnect = onConnect(() => {
      console.log('Terminal WebSocket connected');
      if (writelnRef.current) {
        writelnRef.current('\r\n\x1b[32m● Connected to container terminal\x1b[0m\r\n');
      }
    });

    const unsubscribeDisconnect = onDisconnect(() => {
      console.log('Terminal WebSocket disconnected');
      if (writelnRef.current) {
        writelnRef.current('\r\n\x1b[31m● Disconnected from container terminal\x1b[0m\r\n');
      }
    });

    const unsubscribeError = onError((error: Error) => {
      console.error('Terminal WebSocket error:', error);
      if (writelnRef.current) {
        writelnRef.current(`\r\n\x1b[31m● Connection error: ${error.message}\x1b[0m\r\n`);
      }
    });

    return () => {
      unsubscribeOutput();
      unsubscribeConnect();
      unsubscribeDisconnect();
      unsubscribeError();
    };
  }, [onOutput, onConnect, onDisconnect, onError]);

  // Stable callback functions
  const handleData = useCallback((data: string) => {
    // Send terminal input to WebSocket
    sendInput(data);
    onData?.(data);
  }, [sendInput, onData]);

  const handleResize = useCallback((resizeData: any) => {
    // Send resize event to WebSocket
    if (resizeData && typeof resizeData.cols === 'number' && typeof resizeData.rows === 'number') {
      sendResize(resizeData.cols, resizeData.rows);
    }
    onResize?.(resizeData);
  }, [sendResize, onResize]);

  const handleControlKey = useCallback((key: string, event: KeyboardEvent) => {
    // Handle control key combinations
    if (['SIGINT', 'SIGTERM', 'SIGTSTP', 'SIGQUIT'].includes(key)) {
      event.preventDefault();
      // Send control signal to WebSocket
      sendControlSignal(key as any);
    }
  }, [sendControlSignal]);

  // Terminal hook for xterm.js management
  const {
    terminal,
    isReady: terminalReady,
    write,
    writeln,
    focus,
    dimensions
  } = useTerminal(terminalRef, {
    onData: handleData,
    onResize: handleResize,
    onControlKey: handleControlKey,
    enableResizeObserver: false,
    resizeDebounceMs: 500,
    enableKeyboardShortcuts: true
  });

  // Store terminal functions in refs for WebSocket callbacks
  useEffect(() => {
    writeRef.current = write;
    writelnRef.current = writeln;
  }, [write, writeln]);

  // Focus terminal on mount and when it becomes ready
  useEffect(() => {
    if (terminalReady && terminal) {
      focus();
      onReady?.(terminal);
    }
  }, [terminalReady, terminal, focus, onReady]);

  // Connection status effect - send resize with delay to ensure connection is stable
  useEffect(() => {
    if (isConnected && terminalReady && dimensions) {
      // Small delay to ensure WebSocket is fully ready
      const timer = setTimeout(() => {
        sendResize(dimensions.cols, dimensions.rows);
      }, 100);
      
      return () => clearTimeout(timer);
    }
    
    return undefined;
  }, [isConnected, terminalReady, dimensions, sendResize]);

  return (
    <div className={`terminal-container h-full flex flex-col ${className}`}>
      {/* Connection status indicator */}
      <div className="flex items-center justify-between bg-gray-800/50 px-4 py-2 text-sm border-b border-gray-700/30">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-500'
          }`} />
          <span className="text-gray-300 font-medium">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div className="text-gray-400 text-xs font-mono bg-gray-700/30 px-2 py-1 rounded">
          {dimensions.cols}×{dimensions.rows}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-900/50 border-l-4 border-red-500 px-4 py-3 text-red-200 text-sm">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path>
            </svg>
            <span className="font-semibold">Connection Error:</span>
            <span>{String(error)}</span>
          </div>
        </div>
      )}

      {/* Terminal container */}
      <div className="flex-1 relative overflow-hidden">
        <div 
          ref={terminalRef}
          className={`terminal-element h-full w-full bg-gray-900 ${
            !terminalReady ? 'opacity-50' : ''
          }`}
          style={{ 
            fontFamily: 'Monaco, "Cascadia Code", "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
            fontSize: '14px',
            lineHeight: '1.2'
          }}
        />

        {/* Loading overlay */}
        {!terminalReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm">
            <div className="flex items-center space-x-3 text-gray-300 bg-gray-800/80 px-4 py-3 rounded-lg border border-gray-700/50">
              <div className="animate-spin w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full" />
              <span className="text-sm font-medium">Initializing terminal...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Terminal;
