import React, { useRef, useEffect, useCallback } from 'react';
import { useTerminal } from '../hooks/useTerminal';
import { useWebSocket } from '../hooks/useWebSocket';
import { TerminalMessage, TerminalProps } from '../types/terminal';
import '@xterm/xterm/css/xterm.css';

const Terminal: React.FC<TerminalProps> = ({
  className = '',
  onReady,
  onData,
  onResize
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const sendMessageRef = useRef<((message: TerminalMessage) => void) | null>(null);

  // Create refs for terminal functions that will be available later
  const writeRef = useRef<((data: string) => void) | null>(null);
  const writelnRef = useRef<((data: string) => void) | null>(null);

  // WebSocket hook for server communication
  const { isConnected, error, sendMessage } = useWebSocket(
    `ws://localhost:3000/ws`,
    {
      onMessage: useCallback((message: TerminalMessage) => {
        switch (message.type) {
          case 'output':
            if (typeof message.data === 'string' && writeRef.current) {
              writeRef.current(message.data);
            }
            break;
          case 'control':
            // Handle control signals if needed
            break;
        }
      }, []),
      onConnect: useCallback(() => {
        console.log('WebSocket connected');
        if (writelnRef.current) {
          writelnRef.current('\r\n\x1b[32m● Connected to container terminal\x1b[0m\r\n');
        }
      }, []),
      onDisconnect: useCallback(() => {
        console.log('WebSocket disconnected');
        if (writelnRef.current) {
          writelnRef.current('\r\n\x1b[31m● Disconnected from container terminal\x1b[0m\r\n');
        }
      }, []),
      onError: useCallback((error) => {
        console.error('WebSocket error:', error);
        if (writelnRef.current) {
          writelnRef.current(`\r\n\x1b[31m● Connection error\x1b[0m\r\n`);
        }
      }, [])
    }
  );

  // Store sendMessage in ref for use in terminal hook
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  // Terminal hook for xterm.js management
  const {
    terminal,
    isReady: terminalReady,
    write,
    writeln,
    focus,
    dimensions
  } = useTerminal(terminalRef, {
    onData: (data) => {
      // Send terminal input to WebSocket
      sendMessageRef.current?.({
        type: 'input',
        data,
        timestamp: Date.now()
      });
      onData?.(data);
    },
    onResize: (resizeData) => {
      // Send resize event to WebSocket
      sendMessageRef.current?.({
        type: 'resize',
        data: resizeData,
        timestamp: Date.now()
      });
      onResize?.(resizeData);
    }
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

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+C handling
      if (event.ctrlKey && event.key === 'c') {
        sendMessage({
          type: 'control',
          data: { signal: 'SIGINT' },
          timestamp: Date.now()
        });
      }
    };

    if (terminalReady) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      if (terminalReady) {
        document.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [terminalReady, sendMessage]);

  return (
    <div className={`terminal-container ${className}`}>
      {/* Connection status indicator */}
      <div className="flex items-center justify-between bg-gray-800 px-4 py-2 text-sm">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-red-500'
          }`} />
          <span className="text-gray-300">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div className="text-gray-400 text-xs">
          {dimensions.cols}×{dimensions.rows}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-900/50 border border-red-500 px-4 py-2 text-red-200 text-sm">
          <span className="font-semibold">Connection Error:</span> {error}
        </div>
      )}

      {/* Terminal container */}
      <div 
        ref={terminalRef}
        className={`terminal-element bg-gray-900 flex-1 ${
          !terminalReady ? 'opacity-50' : ''
        }`}
        style={{ minHeight: '400px' }}
      />

      {/* Loading overlay */}
      {!terminalReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/75">
          <div className="flex items-center space-x-2 text-gray-300">
            <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
            <span>Initializing terminal...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Terminal;
