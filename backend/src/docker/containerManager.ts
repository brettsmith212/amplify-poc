/**
 * Container lifecycle management with session ID generation
 */

import Docker from 'dockerode';
import { dockerLogger } from '../utils/logger';
import { EnvironmentConfig } from '../config/environment';
import { ContainerCleanup, createContainerCleanup } from './cleanup';

export interface ContainerConfig {
  sessionId: string;
  workspaceDir: string;
  environment: Record<string, string>;
  baseImage: string;
}

export interface ContainerInfo {
  id: string;
  name: string;
  status: string;
  created: string;
  ports: Array<{ host: number; container: number; type: string }>;
}

export interface ContainerCreateResult {
  success: boolean;
  container?: ContainerInfo;
  error?: string;
}

export interface ContainerRunResult {
  success: boolean;
  containerId?: string;
  error?: string;
}

export class ContainerManager {
  private docker: Docker;
  private cleanup: ContainerCleanup;

  constructor() {
    this.docker = new Docker();
    this.cleanup = createContainerCleanup();
  }

  /**
   * Create a new container for the session
   */
  async createContainer(config: ContainerConfig): Promise<ContainerCreateResult> {
    try {
      dockerLogger.info(`Creating container for session: ${config.sessionId}`);
      
      const containerName = `amplify-${config.sessionId}`;
      
      // Container configuration matching PRD specifications
      const containerOptions = {
        name: containerName,
        Image: config.baseImage,
        Env: this.formatEnvironmentVariables(config.environment),
        WorkingDir: '/workspace',
        User: 'amplify',
        HostConfig: {
          // Mount workspace read-only as specified in PRD
          Binds: [`${config.workspaceDir}:/workspace:ro`],
          // Expose ports for potential web server and SSH
          PortBindings: {
            '22/tcp': [{ HostPort: '' }], // Dynamic port assignment
            '80/tcp': [{ HostPort: '' }]  // Dynamic port assignment
          },
          // Resource limits
          Memory: 512 * 1024 * 1024, // 512MB
          CpuShares: 512,
          // Auto-remove when stopped
          AutoRemove: false, // We handle cleanup manually for better control
          // Security options
          ReadonlyRootfs: false, // amp needs to write to some locations
          // Network mode
          NetworkMode: 'bridge'
        },
        ExposedPorts: {
          '22/tcp': {},
          '80/tcp': {}
        },
        // Labels for identification
        Labels: {
          'amplify.session': config.sessionId,
          'amplify.created': new Date().toISOString(),
          'amplify.version': '0.1.0'
        },
        // Keep container running
        Cmd: ['bash'],
        Tty: true,
        OpenStdin: true,
        StdinOnce: false,
        AttachStdin: false,
        AttachStdout: false,
        AttachStderr: false
      };

      dockerLogger.debug('Container options', {
        name: containerName,
        image: config.baseImage,
        workspace: config.workspaceDir,
        envVars: Object.keys(config.environment).length
      });

      const container = await this.docker.createContainer(containerOptions);
      
      dockerLogger.info(`Container created: ${containerName}`, {
        id: container.id.substring(0, 12)
      });

      const containerInfo: ContainerInfo = {
        id: container.id,
        name: containerName,
        status: 'created',
        created: new Date().toISOString(),
        ports: []
      };

      return {
        success: true,
        container: containerInfo
      };

    } catch (error: any) {
      dockerLogger.error('Failed to create container', {
        sessionId: config.sessionId,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Start a created container
   */
  async startContainer(containerId: string): Promise<ContainerRunResult> {
    try {
      dockerLogger.info(`Starting container: ${containerId.substring(0, 12)}`);
      
      const container = this.docker.getContainer(containerId);
      await container.start();
      
      // Get container info after starting
      const containerInfo = await container.inspect();
      const ports = this.extractPortMappings(containerInfo);
      
      dockerLogger.info(`Container started successfully`, {
        id: containerId.substring(0, 12),
        name: containerInfo.Name,
        ports: ports
      });

      return {
        success: true,
        containerId
      };

    } catch (error: any) {
      dockerLogger.error(`Failed to start container: ${containerId.substring(0, 12)}`, error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create and start a container in one operation
   */
  async runContainer(config: ContainerConfig): Promise<ContainerRunResult> {
    // Create container
    const createResult = await this.createContainer(config);
    if (!createResult.success || !createResult.container) {
      return {
        success: false,
        error: createResult.error || 'Failed to create container'
      };
    }

    // Start container
    const startResult = await this.startContainer(createResult.container.id);
    if (!startResult.success) {
      // Clean up created container if start fails
      await this.cleanup.cleanupContainer(createResult.container.id, { force: true });
      return startResult;
    }

    // Set up cleanup handlers for graceful shutdown
    this.cleanup.setupCleanupHandlers(createResult.container.id);

    dockerLogger.info('Container is running and ready', {
      sessionId: config.sessionId,
      containerId: createResult.container.id.substring(0, 12)
    });

    return {
      success: true,
      containerId: createResult.container.id
    };
  }

  /**
   * Get container status and info
   */
  async getContainerInfo(containerId: string): Promise<ContainerInfo | null> {
    try {
      const container = this.docker.getContainer(containerId);
      const containerInfo = await container.inspect();
      
      const ports = this.extractPortMappings(containerInfo);
      
      return {
        id: containerInfo.Id,
        name: containerInfo.Name.replace(/^\//, ''),
        status: containerInfo.State.Status,
        created: containerInfo.Created,
        ports
      };
    } catch (error: any) {
      if (error.statusCode === 404) {
        dockerLogger.debug(`Container not found: ${containerId.substring(0, 12)}`);
        return null;
      }
      dockerLogger.error(`Error getting container info: ${containerId.substring(0, 12)}`, error);
      return null;
    }
  }

  /**
   * Stop and remove a container
   */
  async stopContainer(containerId: string): Promise<boolean> {
    const result = await this.cleanup.cleanupContainer(containerId, { 
      force: false, 
      timeout: 10 
    });
    return result.success;
  }

  /**
   * Execute a command in the container
   */
  async executeCommand(containerId: string, command: string[]): Promise<any> {
    try {
      const container = this.docker.getContainer(containerId);
      
      const exec = await container.exec({
        Cmd: command,
        AttachStdout: true,
        AttachStderr: true,
        AttachStdin: true,
        Tty: true,
        User: 'amplify'
      });

      return exec;
    } catch (error: any) {
      dockerLogger.error(`Failed to execute command in container: ${containerId.substring(0, 12)}`, {
        command,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Format environment variables for Docker API
   */
  private formatEnvironmentVariables(env: Record<string, string>): string[] {
    return Object.entries(env).map(([key, value]) => `${key}=${value}`);
  }

  /**
   * Extract port mappings from container info
   */
  private extractPortMappings(containerInfo: any): Array<{ host: number; container: number; type: string }> {
    const ports: Array<{ host: number; container: number; type: string }> = [];
    
    if (containerInfo.NetworkSettings?.Ports) {
      for (const [containerPort, hostPorts] of Object.entries(containerInfo.NetworkSettings.Ports)) {
        if (hostPorts && Array.isArray(hostPorts)) {
          for (const hostPort of hostPorts) {
            const [port, protocol] = containerPort.split('/');
            if (port && protocol && hostPort.HostPort) {
              ports.push({
                container: parseInt(port),
                host: parseInt(hostPort.HostPort),
                type: protocol
              });
            }
          }
        }
      }
    }
    
    return ports;
  }

  /**
   * Clean up a container
   */
  async cleanupContainer(containerId: string): Promise<boolean> {
    try {
      const result = await this.cleanup.cleanupContainer(containerId);
      return result.success;
    } catch (error) {
      dockerLogger.error('Error cleaning up container', { containerId, error });
      return false;
    }
  }

  /**
   * Get the Docker instance
   */
  getDocker(): Docker {
    return this.docker;
  }
}

/**
 * Create a ContainerManager instance
 */
export function createContainerManager(): ContainerManager {
  return new ContainerManager();
}
