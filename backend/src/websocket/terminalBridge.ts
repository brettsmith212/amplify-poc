import WebSocket from 'ws';
import { DockerExecManager } from '../docker/execManager';
import { WebSocketMessageHandler, TerminalMessage, ResizeData, ControlData } from './messageHandler';
import { TerminalControl, TerminalControlSignal, TerminalResizeEvent } from './terminalControl';
import { TerminalSessionManager, TerminalSessionInfo } from './sessionManager';
import { logger } from '../utils/logger';
import { generateSessionId } from '../config/environment';

export interface TerminalSession {
  id: string;
  websocket: WebSocket;
  execManager: DockerExecManager;
  messageHandler: WebSocketMessageHandler;
  shellSessionId?: string;
  isActive: boolean;
  sessionInfo?: TerminalSessionInfo;
}

export class TerminalBridge {
  private sessions: Map<string, TerminalSession> = new Map();
  private execManager: DockerExecManager;
  private terminalControl: TerminalControl;
  private sessionManager: TerminalSessionManager;

  constructor(execManager: DockerExecManager) {
    this.execManager = execManager;
    this.terminalControl = new TerminalControl({
      enableSignalHandling: true,
      enableResizeHandling: true,
      debounceResizeMs: 150,
      maxCols: 200,
      maxRows: 100,
      minCols: 10,
      minRows: 5
    });
    this.sessionManager = new TerminalSessionManager({
      maxIdleTimeMs: 30 * 60 * 1000, // 30 minutes
      cleanupIntervalMs: 5 * 60 * 1000, // 5 minutes
      maxSessions: 50,
      enableStats: true
    });

    this.setupControlHandlers();
  }

  private setupControlHandlers(): void {
    // Handle control signals
    this.terminalControl.on('signal', (signal: TerminalControlSignal) => {
      const session = this.sessions.get(signal.sessionId);
      if (session?.shellSessionId) {
        this.execManager.killSession(session.shellSessionId, signal.signal);
      }
      this.sessionManager.recordControlSignal(signal.sessionId, signal.signal);
    });

    // Handle resize events
    this.terminalControl.on('resize', (resizeEvent: TerminalResizeEvent) => {
      const session = this.sessions.get(resizeEvent.sessionId);
      if (session?.shellSessionId) {
        this.execManager.resizeSession(session.shellSessionId, resizeEvent.cols, resizeEvent.rows);
      }
      this.sessionManager.updateTerminalInfo(resizeEvent.sessionId, resizeEvent.cols, resizeEvent.rows);
    });

    // Clean up sessions when they're removed from session manager
    this.sessionManager.on('sessionRemoved', (sessionId: string) => {
      this.cleanup(sessionId);
    });
  }

  async handleConnection(
    websocket: WebSocket, 
    sessionId?: string,
    clientInfo?: { userAgent?: string; remoteAddress?: string }
  ): Promise<string> {
    const terminalSessionId = sessionId || generateSessionId();
    
    logger.info(`New WebSocket connection for terminal session: ${terminalSessionId}`);

    // Create session in session manager
    const sessionInfo = this.sessionManager.createSession(clientInfo);
    const messageHandler = new WebSocketMessageHandler();
    
    const session: TerminalSession = {
      id: terminalSessionId,
      websocket,
      execManager: this.execManager,
      messageHandler,
      isActive: true,
      sessionInfo
    };

    this.sessions.set(terminalSessionId, session);
    this.setupWebSocketHandlers(session);
    this.setupMessageHandlers(session);

    // Send welcome message
    this.sendMessage(session, messageHandler.createOutputMessage(
      '\r\n\x1b[32m● Terminal connected to Docker container\x1b[0m\r\n'
    ));

    // Start shell session
    await this.startShellSession(session);

    return terminalSessionId;
  }

  private setupWebSocketHandlers(session: TerminalSession): void {
    const { websocket, messageHandler } = session;

    websocket.on('message', async (data: WebSocket.Data) => {
      try {
        const message = data.toString();
        this.sessionManager.recordMessage(session.id, 'received', message.length);
        await messageHandler.handleMessage(message);
      } catch (error) {
        logger.error(`Error handling WebSocket message for session ${session.id}:`, error);
      }
    });

    websocket.on('close', () => {
      logger.info(`WebSocket connection closed for session ${session.id}`);
      this.cleanup(session.id);
    });

    websocket.on('error', (error) => {
      logger.error(`WebSocket error for session ${session.id}:`, error);
      this.cleanup(session.id);
    });

    websocket.on('pong', () => {
      logger.debug(`Received pong from session ${session.id}`);
    });
  }

  private setupMessageHandlers(session: TerminalSession): void {
    const { messageHandler } = session;

    // Handle terminal input
    messageHandler.on('input', async (message: TerminalMessage) => {
      if (typeof message.data === 'string') {
        await this.handleTerminalInput(session, message.data);
      }
    });

    // Handle terminal resize
    messageHandler.on('resize', async (message: TerminalMessage) => {
      if (this.isResizeData(message.data)) {
        const resizeEvent = this.terminalControl.createResizeEvent(
          session.id,
          message.data.cols,
          message.data.rows
        );
        this.terminalControl.handleResizeEvent(resizeEvent);
      }
    });

    // Handle control signals
    messageHandler.on('control', async (message: TerminalMessage) => {
      if (this.isControlData(message.data)) {
        const controlSignal = this.terminalControl.createControlSignal(
          message.data.signal,
          session.id
        );
        this.terminalControl.handleControlSignal(controlSignal);
      }
    });
  }

  private async startShellSession(session: TerminalSession): Promise<void> {
    try {
      const shellSessionId = generateSessionId();
      session.shellSessionId = shellSessionId;

      // Create shell exec session
      const execSession = await this.execManager.createExecSession(shellSessionId, {
        cmd: ['/bin/bash', '-l'],
        tty: true,
        attachStdin: true,
        attachStdout: true,
        attachStderr: true,
        workingDir: '/workspace'
      });

      // Set up exec session event handlers
      this.execManager.on('output', (execSessionId: string, data: Buffer) => {
        if (execSessionId === shellSessionId) {
          const output = data.toString();
          logger.debug(`Shell output for ${execSessionId}:`, { output: JSON.stringify(output) });
          this.sendMessage(session, session.messageHandler.createOutputMessage(output));
        }
      });

      this.execManager.on('error', (execSessionId: string, error: Error) => {
        if (execSessionId === shellSessionId) {
          logger.error(`Exec session error for ${execSessionId}:`, error);
          this.sendMessage(session, session.messageHandler.createOutputMessage(
            `\r\n\x1b[31m● Shell session error: ${error instanceof Error ? error.message : String(error)}\x1b[0m\r\n`
          ));
        }
      });

      this.execManager.on('end', (execSessionId: string) => {
        if (execSessionId === shellSessionId) {
          logger.info(`Shell session ${execSessionId} ended`);
          this.sendMessage(session, session.messageHandler.createOutputMessage(
            '\r\n\x1b[33m● Shell session ended\x1b[0m\r\n'
          ));
          this.cleanup(session.id);
        }
      });

      // Start the exec session
      await this.execManager.startExecSession(shellSessionId);
      
      // Send initial newline to trigger shell prompt
      setTimeout(async () => {
        await this.execManager.writeToSession(shellSessionId, '\r');
      }, 100);
      
      // Update session manager with shell info
      this.sessionManager.updateShellInfo(session.id, shellSessionId, '/workspace');
      
      logger.info(`Started shell session ${shellSessionId} for terminal ${session.id}`);
    } catch (error) {
      logger.error(`Failed to start shell session for terminal ${session.id}:`, error);
      this.sendMessage(session, session.messageHandler.createOutputMessage(
        `\r\n\x1b[31m● Failed to start shell: ${error instanceof Error ? error.message : String(error)}\x1b[0m\r\n`
      ));
    }
  }

  private async handleTerminalInput(session: TerminalSession, input: string): Promise<void> {
    if (!session.shellSessionId) {
      logger.warn(`No shell session for terminal ${session.id}`);
      return;
    }

    try {
      const success = await this.execManager.writeToSession(session.shellSessionId, input);
      if (!success) {
        logger.warn(`Failed to write input to shell session ${session.shellSessionId}`);
      }
    } catch (error) {
      logger.error(`Error writing to shell session ${session.shellSessionId}:`, error);
    }
  }

  private async handleTerminalResize(session: TerminalSession, resizeData: ResizeData): Promise<void> {
    if (!session.shellSessionId) {
      logger.warn(`No shell session for terminal ${session.id}`);
      return;
    }

    try {
      await this.execManager.resizeSession(session.shellSessionId, resizeData.cols, resizeData.rows);
      logger.debug(`Resized terminal ${session.id} to ${resizeData.cols}x${resizeData.rows}`);
    } catch (error) {
      logger.error(`Error resizing terminal ${session.id}:`, error);
    }
  }

  private async handleControlSignal(session: TerminalSession, controlData: ControlData): Promise<void> {
    if (!session.shellSessionId) {
      logger.warn(`No shell session for terminal ${session.id}`);
      return;
    }

    try {
      await this.execManager.killSession(session.shellSessionId, controlData.signal);
      logger.info(`Sent ${controlData.signal} to shell session ${session.shellSessionId}`);
    } catch (error) {
      logger.error(`Error sending signal to shell session ${session.shellSessionId}:`, error);
    }
  }

  private sendMessage(session: TerminalSession, message: TerminalMessage): void {
    if (session.websocket.readyState === WebSocket.OPEN) {
      const serialized = session.messageHandler.serializeMessage(message);
      session.websocket.send(serialized);
      this.sessionManager.recordMessage(session.id, 'sent', serialized.length);
    }
  }

  private isResizeData(data: any): data is ResizeData {
    return (
      data &&
      typeof data === 'object' &&
      typeof data.cols === 'number' &&
      typeof data.rows === 'number'
    );
  }

  private isControlData(data: any): data is ControlData {
    return (
      data &&
      typeof data === 'object' &&
      typeof data.signal === 'string'
    );
  }

  cleanup(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
      
      // Clean up shell session
      if (session.shellSessionId) {
        this.execManager.cleanup(session.shellSessionId);
      }

      // Clean up terminal control and session manager
      this.terminalControl.cleanupSession(sessionId);
      this.sessionManager.removeSession(sessionId);

      // Close WebSocket if still open
      if (session.websocket.readyState === WebSocket.OPEN) {
        session.websocket.close();
      }

      this.sessions.delete(sessionId);
      logger.info(`Cleaned up terminal session ${sessionId}`);
    }
  }

  cleanupAll(): void {
    logger.info('Cleaning up all terminal sessions');
    for (const sessionId of this.sessions.keys()) {
      this.cleanup(sessionId);
    }
    
    // Clean up terminal control and session manager
    this.terminalControl.cleanupAll();
    this.sessionManager.shutdown();
  }

  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  getSession(sessionId: string): TerminalSession | undefined {
    return this.sessions.get(sessionId);
  }

  // Health check for keeping connections alive
  pingAllSessions(): void {
    for (const session of this.sessions.values()) {
      if (session.websocket.readyState === WebSocket.OPEN) {
        session.websocket.ping();
      }
    }
  }
}
