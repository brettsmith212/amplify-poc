/**
 * Session data model and interfaces
 */

export interface Session {
  id: string;
  userId: string;
  repositoryUrl: string;
  repositoryName: string;
  branch: string;
  status: SessionStatus;
  containerId?: string;
  containerName?: string;
  createdAt: Date;
  lastAccessedAt: Date;
  expiresAt: Date;
  metadata: SessionMetadata;
}

export enum SessionStatus {
  CREATING = 'creating',
  READY = 'ready',
  RUNNING = 'running',
  IDLE = 'idle',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error'
}

export interface SessionMetadata {
  gitCommitHash?: string;
  workspaceSize?: number;
  lastCommand?: string;
  errorCount?: number;
  connectionCount?: number;
  tags?: string[];
}

export interface CreateSessionRequest {
  repositoryUrl: string;
  branch: string;
  tags?: string[];
}

export interface SessionSummary {
  id: string;
  repositoryName: string;
  branch: string;
  status: SessionStatus;
  createdAt: Date;
  lastAccessedAt: Date;
  expiresAt: Date;
  connectionCount: number;
}

export interface SessionConnection {
  sessionId: string;
  connectionId: string;
  connectedAt: Date;
  lastActivityAt: Date;
  isActive: boolean;
}

export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  userSessions: number;
  oldestSession?: Date | undefined;
  newestSession?: Date | undefined;
  totalConnections: number;
  activeConnections: number;
}
