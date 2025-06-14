import Docker from 'dockerode';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface ExecOptions {
  cmd: string[];
  env?: string[];
  workingDir?: string;
  tty?: boolean;
  attachStdin?: boolean;
  attachStdout?: boolean;
  attachStderr?: boolean;
}

export interface ExecSession {
  id: string;
  exec: Docker.Exec;
  stream?: NodeJS.ReadWriteStream;
  isActive: boolean;
}

export class DockerExecManager extends EventEmitter {
  private docker: Docker;
  private containerId: string;
  private execSessions: Map<string, ExecSession> = new Map();

  constructor(docker: Docker, containerId: string) {
    super();
    this.docker = docker;
    this.containerId = containerId;
  }

  async createExecSession(sessionId: string, options: ExecOptions): Promise<ExecSession> {
    try {
      const container = this.docker.getContainer(this.containerId);
      
      const execOptions = {
        Cmd: options.cmd,
        Env: options.env || [],
        WorkingDir: options.workingDir || '/workspace',
        Tty: options.tty ?? true,
        AttachStdin: options.attachStdin ?? true,
        AttachStdout: options.attachStdout ?? true,
        AttachStderr: options.attachStderr ?? true,
      };

      logger.info(`Creating exec session ${sessionId} with command: ${options.cmd.join(' ')}`);
      
      const exec = await container.exec(execOptions);
      
      const session: ExecSession = {
        id: sessionId,
        exec,
        isActive: false
      };

      this.execSessions.set(sessionId, session);
      return session;
    } catch (error) {
      logger.error(`Failed to create exec session ${sessionId}:`, error);
      throw error;
    }
  }

  async startExecSession(sessionId: string): Promise<NodeJS.ReadWriteStream> {
    const session = this.execSessions.get(sessionId);
    if (!session) {
      throw new Error(`Exec session ${sessionId} not found`);
    }

    try {
      logger.info(`Starting exec session ${sessionId}`);
      
      const stream = await session.exec.start({
        hijack: true,
        stdin: true,
        Tty: true
      });

      session.stream = stream;
      session.isActive = true;

      // Handle stream events
      stream.on('data', (data: Buffer) => {
        this.emit('output', sessionId, data);
      });

      stream.on('error', (error: Error) => {
        logger.error(`Exec session ${sessionId} stream error:`, error);
        this.emit('error', sessionId, error);
        this.cleanup(sessionId);
      });

      stream.on('end', () => {
        logger.info(`Exec session ${sessionId} stream ended`);
        this.emit('end', sessionId);
        this.cleanup(sessionId);
      });

      return stream;
    } catch (error) {
      logger.error(`Failed to start exec session ${sessionId}:`, error);
      this.cleanup(sessionId);
      throw error;
    }
  }

  async writeToSession(sessionId: string, data: string | Buffer): Promise<boolean> {
    const session = this.execSessions.get(sessionId);
    if (!session || !session.stream || !session.isActive) {
      logger.warn(`Cannot write to inactive exec session ${sessionId}`);
      return false;
    }

    try {
      return session.stream.write(data);
    } catch (error) {
      logger.error(`Failed to write to exec session ${sessionId}:`, error);
      return false;
    }
  }

  async resizeSession(sessionId: string, cols: number, rows: number): Promise<void> {
    const session = this.execSessions.get(sessionId);
    if (!session || !session.isActive) {
      logger.warn(`Cannot resize inactive exec session ${sessionId}`);
      return;
    }

    try {
      await session.exec.resize({ h: rows, w: cols });
      logger.debug(`Resized exec session ${sessionId} to ${cols}x${rows}`);
    } catch (error) {
      logger.error(`Failed to resize exec session ${sessionId}:`, error);
    }
  }

  async killSession(sessionId: string, signal: string = 'SIGTERM'): Promise<void> {
    const session = this.execSessions.get(sessionId);
    if (!session) {
      logger.warn(`Exec session ${sessionId} not found for kill`);
      return;
    }

    try {
      if (session.stream && session.isActive) {
        // Send signal to the process
        const container = this.docker.getContainer(this.containerId);
        await container.kill({ signal });
        logger.info(`Sent ${signal} to exec session ${sessionId}`);
      }
    } catch (error) {
      logger.error(`Failed to kill exec session ${sessionId}:`, error);
    } finally {
      this.cleanup(sessionId);
    }
  }

  cleanup(sessionId: string): void {
    const session = this.execSessions.get(sessionId);
    if (session) {
      session.isActive = false;
      if (session.stream) {
        try {
          session.stream.end();
        } catch (error) {
          logger.error(`Error ending stream for session ${sessionId}:`, error);
        }
      }
      this.execSessions.delete(sessionId);
      logger.info(`Cleaned up exec session ${sessionId}`);
    }
  }

  getActiveSessionIds(): string[] {
    return Array.from(this.execSessions.entries())
      .filter(([, session]) => session.isActive)
      .map(([id]) => id);
  }

  isSessionActive(sessionId: string): boolean {
    const session = this.execSessions.get(sessionId);
    return session?.isActive ?? false;
  }

  cleanupAll(): void {
    logger.info('Cleaning up all exec sessions');
    for (const sessionId of this.execSessions.keys()) {
      this.cleanup(sessionId);
    }
  }
}
