import { useState, useEffect, useCallback, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { TerminalHookState, ResizeData } from '../types/terminal';

interface UseTerminalOptions {
  onData?: (data: string) => void;
  onResize?: (data: ResizeData) => void;
  theme?: {
    background?: string;
    foreground?: string;
    cursor?: string;
  };
}

export const useTerminal = (
  containerRef: React.RefObject<HTMLElement>,
  options: UseTerminalOptions = {}
) => {
  const { onData, onResize, theme } = options;

  const [state, setState] = useState<TerminalHookState>({
    terminal: null,
    isReady: false,
    dimensions: { cols: 80, rows: 24 }
  });

  const fitAddonRef = useRef<FitAddon>();
  const resizeObserverRef = useRef<ResizeObserver>();

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
    }
  }, [state.terminal]);

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

  useEffect(() => {
    const terminal = initializeTerminal();

    if (terminal && containerRef.current) {
      // Set up resize observer
      resizeObserverRef.current = new ResizeObserver(() => {
        setTimeout(() => fit(), 0);
      });
      
      resizeObserverRef.current.observe(containerRef.current);
    }

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      if (terminal) {
        terminal.dispose();
      }
    };
  }, [containerRef, initializeTerminal, fit]);

  return {
    ...state,
    fit,
    write,
    writeln,
    clear,
    focus
  };
};
