import WebSocket from 'ws';
import { DockerExecManager } from '../docker/execManager';
import { WebSocketMessageHandler, TerminalMessage, ResizeData, ControlData } from './messageHandler';
import { logger } from '../utils/logger';
import { generateSessionId } from '../config/environment';

export interface TerminalSession {
  id: string;
  websocket: WebSocket;
  execManager: DockerExecManager;
  messageHandler: WebSocketMessageHandler;
  shellSessionId?: string;
  isActive: boolean;
}

export class TerminalBridge {
  private sessions: Map<string, TerminalSession> = new Map();
  private execManager: DockerExecManager;

  constructor(execManager: DockerExecManager) {
    this.execManager = execManager;
  }

  async handleConnection(websocket: WebSocket, sessionId?: string): Promise<string> {
    const terminalSessionId = sessionId || generateSessionId();
    
    logger.info(`New WebSocket connection for terminal session: ${terminalSessionId}`);

    const messageHandler = new WebSocketMessageHandler();
    
    const session: TerminalSession = {
      id: terminalSessionId,
      websocket,
      execManager: this.execManager,
      messageHandler,
      isActive: true
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
        await this.handleTerminalResize(session, message.data);
      }
    });

    // Handle control signals
    messageHandler.on('control', async (message: TerminalMessage) => {
      if (this.isControlData(message.data)) {
        await this.handleControlSignal(session, message.data);
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
          this.sendMessage(session, session.messageHandler.createOutputMessage(data.toString()));
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
