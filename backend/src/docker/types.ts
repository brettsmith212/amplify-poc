/**
 * TypeScript interfaces for Docker operations
 */

export interface DockerImageInfo {
  id: string;
  tags: string[];
  size: number;
  created: string;
  repoTags?: string[];
}

export interface ImageBuildOptions {
  imageName: string;
  dockerfilePath: string;
  contextPath: string;
  buildArgs?: Record<string, string>;
}

export interface ImageInspectResult {
  exists: boolean;
  imageInfo?: DockerImageInfo;
  error?: string;
}

export interface ImageBuildResult {
  success: boolean;
  imageId?: string | undefined;
  error?: string | undefined;
  buildLogs?: string[] | undefined;
}

export interface DockerManagerConfig {
  baseImageName: string;
  dockerfilePath: string;
  projectRoot: string;
}

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  component?: string;
  details?: any;
}
