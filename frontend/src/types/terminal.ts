export interface TerminalMessage {
  type: 'input' | 'output' | 'resize' | 'control';
  data: string | ResizeData | ControlData;
  timestamp: number;
}

export interface ResizeData {
  cols: number;
  rows: number;
}

export interface ControlData {
  signal: 'SIGINT' | 'SIGTERM' | 'SIGKILL' | 'SIGTSTP' | 'SIGCONT' | 'SIGQUIT';
}

export interface WebSocketHookState {
  socket: WebSocket | null;
  isConnected: boolean;
  error: string | null;
  reconnectAttempts: number;
}

export interface TerminalHookState {
  terminal: import('@xterm/xterm').Terminal | null;
  isReady: boolean;
  dimensions: ResizeData;
}

export interface TerminalProps {
  className?: string;
  sessionId?: string;
  onReady?: (terminal: import('@xterm/xterm').Terminal) => void;
  onData?: (data: string) => void;
  onResize?: (data: ResizeData) => void;
}
