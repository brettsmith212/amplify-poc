import { useState, useEffect, useCallback, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { TerminalHookState, ResizeData } from '../types/terminal';

interface UseTerminalOptions {
  onData?: (data: string) => void;
  onResize?: (data: ResizeData) => void;
  onControlKey?: (key: string, event: KeyboardEvent) => void;
  theme?: {
    background?: string;
    foreground?: string;
    cursor?: string;
  };
  enableResizeObserver?: boolean;
  resizeDebounceMs?: number;
  enableKeyboardShortcuts?: boolean;
}

export const useTerminal = (
  containerRef: React.RefObject<HTMLElement>,
  options: UseTerminalOptions = {}
) => {
  const { 
    onData, 
    onResize, 
    onControlKey,
    theme,
    enableResizeObserver = true,
    resizeDebounceMs = 100,
    enableKeyboardShortcuts = true
  } = options;

  const [state, setState] = useState<TerminalHookState>({
    terminal: null,
    isReady: false,
    dimensions: { cols: 80, rows: 24 }
  });

  const fitAddonRef = useRef<FitAddon>();
  const resizeObserverRef = useRef<ResizeObserver>();
  const resizeTimeoutRef = useRef<number>();
  const keyboardHandlerRef = useRef<((event: KeyboardEvent) => void) | null>(null);

  const initializeTerminal = useCallback(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: 'Monaco, "Cascadia Code", "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
      fontSize: 14,
      lineHeight: 1.2,
      theme: {
        background: theme?.background || '#1a1b26',
        foreground: theme?.foreground || '#c0caf5',
        cursor: theme?.cursor || '#c0caf5',
        black: '#15161e',
        red: '#f7768e',
        green: '#9ece6a',
        yellow: '#e0af68',
        blue: '#7aa2f7',
        magenta: '#bb9af7',
        cyan: '#7dcfff',
        white: '#a9b1d6',
        brightBlack: '#414868',
        brightRed: '#f7768e',
        brightGreen: '#9ece6a',
        brightYellow: '#e0af68',
        brightBlue: '#7aa2f7',
        brightMagenta: '#bb9af7',
        brightCyan: '#7dcfff',
        brightWhite: '#c0caf5'
      }
    });

    // Add addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    
    fitAddonRef.current = fitAddon;

    // Handle data input
    terminal.onData((data) => {
      onData?.(data);
    });

    // Handle resize
    terminal.onResize(({ cols, rows }) => {
      const dimensions = { cols, rows };
      setState(prev => ({
        ...prev,
        dimensions
      }));
      onResize?.(dimensions);
    });

    // Open terminal in container
    terminal.open(containerRef.current);
    
    // Initial fit
    setTimeout(() => {
      fitAddon.fit();
      setState(prev => ({
        ...prev,
        terminal,
        isReady: true,
        dimensions: {
          cols: terminal.cols,
          rows: terminal.rows
        }
      }));
    }, 0);

    return terminal;
  }, [containerRef, onData, onResize, theme]);

  const fit = useCallback(() => {
    if (fitAddonRef.current && state.terminal) {
      fitAddonRef.current.fit();
      
      // Update dimensions after fit
      const dimensions = {
        cols: state.terminal.cols,
        rows: state.terminal.rows
      };
      
      setState(prev => ({
        ...prev,
        dimensions
      }));
      
      onResize?.(dimensions);
    }
  }, [state.terminal, onResize]);

  const debouncedFit = useCallback(() => {
    if (resizeTimeoutRef.current) {
      window.clearTimeout(resizeTimeoutRef.current);
    }
    
    resizeTimeoutRef.current = window.setTimeout(() => {
      fit();
    }, resizeDebounceMs);
  }, [fit, resizeDebounceMs]);

  const write = useCallback((data: string) => {
    if (state.terminal && state.isReady) {
      state.terminal.write(data);
    }
  }, [state.terminal, state.isReady]);

  const writeln = useCallback((data: string) => {
    if (state.terminal && state.isReady) {
      state.terminal.writeln(data);
    }
  }, [state.terminal, state.isReady]);

  const clear = useCallback(() => {
    if (state.terminal && state.isReady) {
      state.terminal.clear();
    }
  }, [state.terminal, state.isReady]);

  const focus = useCallback(() => {
    if (state.terminal && state.isReady) {
      state.terminal.focus();
    }
  }, [state.terminal, state.isReady]);

  const setupKeyboardHandler = useCallback(() => {
    if (!enableKeyboardShortcuts) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Handle common terminal control keys
      if (event.ctrlKey) {
        switch (event.key.toLowerCase()) {
          case 'c':
            onControlKey?.('SIGINT', event);
            break;
          case 'z':
            onControlKey?.('SIGTSTP', event);
            break;
          case '\\':
            onControlKey?.('SIGQUIT', event);
            break;
          case 'd':
            // Ctrl-D (EOF)
            onControlKey?.('EOF', event);
            break;
          case 'l':
            // Ctrl-L (clear screen) - let terminal handle this naturally
            break;
        }
      } else if (event.altKey) {
        switch (event.key.toLowerCase()) {
          case 'f4':
            // Alt-F4 equivalent
            onControlKey?.('SIGTERM', event);
            break;
        }
      }
    };

    keyboardHandlerRef.current = handleKeyDown;
    document.addEventListener('keydown', handleKeyDown);
  }, [enableKeyboardShortcuts, onControlKey]);

  const cleanupKeyboardHandler = useCallback(() => {
    if (keyboardHandlerRef.current) {
      document.removeEventListener('keydown', keyboardHandlerRef.current);
      keyboardHandlerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const terminal = initializeTerminal();

    if (terminal && containerRef.current) {
      // Set up resize observer with debouncing
      if (enableResizeObserver) {
        resizeObserverRef.current = new ResizeObserver(() => {
          debouncedFit();
        });
        
        resizeObserverRef.current.observe(containerRef.current);
      }

      // Set up keyboard handler
      setupKeyboardHandler();
    }

    return () => {
      // Clear resize timeout
      if (resizeTimeoutRef.current) {
        window.clearTimeout(resizeTimeoutRef.current);
      }
      
      // Disconnect resize observer
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      
      // Clean up keyboard handler
      cleanupKeyboardHandler();
      
      // Dispose terminal
      if (terminal) {
        terminal.dispose();
      }
    };
  }, [containerRef, initializeTerminal, debouncedFit, enableResizeObserver, setupKeyboardHandler, cleanupKeyboardHandler]);

  return {
    ...state,
    fit,
    debouncedFit,
    write,
    writeln,
    clear,
    focus,
    setupKeyboardHandler,
    cleanupKeyboardHandler
  };
};
