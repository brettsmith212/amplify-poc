/**
 * Container cleanup and removal logic
 */

import Docker from 'dockerode';
import { dockerLogger } from '../utils/logger';

export interface CleanupOptions {
  force?: boolean;
  removeVolumes?: boolean;
  timeout?: number;
}

export interface CleanupResult {
  success: boolean;
  containersRemoved: string[];
  errors: string[];
}

export class ContainerCleanup {
  private docker: Docker;

  constructor() {
    this.docker = new Docker();
  }

  /**
   * Clean up a specific container by ID or name
   */
  async cleanupContainer(containerIdOrName: string, options: CleanupOptions = {}): Promise<CleanupResult> {
    const result: CleanupResult = {
      success: true,
      containersRemoved: [],
      errors: []
    };

    try {
      dockerLogger.info(`Cleaning up container: ${containerIdOrName}`);
      
      const container = this.docker.getContainer(containerIdOrName);
      
      // Check if container exists
      try {
        const containerInfo = await container.inspect();
        dockerLogger.debug('Container info', {
          id: containerInfo.Id.substring(0, 12),
          name: containerInfo.Name,
          state: containerInfo.State.Status
        });
      } catch (error: any) {
        if (error.statusCode === 404) {
          dockerLogger.info(`Container ${containerIdOrName} not found, already cleaned up`);
          return result;
        }
        throw error;
      }
      
      // Stop container if running
      try {
        await container.stop({ t: options.timeout || 10 });
        dockerLogger.debug(`Stopped container: ${containerIdOrName}`);
      } catch (error: any) {
        if (error.statusCode === 304) {
          // Container already stopped
          dockerLogger.debug(`Container ${containerIdOrName} already stopped`);
        } else if (error.statusCode === 404) {
          // Container doesn't exist
          dockerLogger.debug(`Container ${containerIdOrName} not found`);
          return result;
        } else {
          dockerLogger.warn(`Failed to stop container ${containerIdOrName}`, error);
          if (!options.force) {
            result.errors.push(`Failed to stop container: ${error.message}`);
            result.success = false;
            return result;
          }
        }
      }
      
      // Remove container
      try {
        await container.remove({ 
          force: options.force,
          v: options.removeVolumes
        });
        dockerLogger.info(`Removed container: ${containerIdOrName}`);
        result.containersRemoved.push(containerIdOrName);
      } catch (error: any) {
        if (error.statusCode === 404) {
          dockerLogger.debug(`Container ${containerIdOrName} already removed`);
        } else {
          dockerLogger.error(`Failed to remove container ${containerIdOrName}`, error);
          result.errors.push(`Failed to remove container: ${error.message}`);
          result.success = false;
        }
      }
      
    } catch (error: any) {
      dockerLogger.error(`Error during container cleanup: ${containerIdOrName}`, error);
      result.errors.push(`Cleanup error: ${error.message}`);
      result.success = false;
    }

    return result;
  }

  /**
   * Clean up all amplify containers
   */
  async cleanupAllAmplifyContainers(options: CleanupOptions = {}): Promise<CleanupResult> {
    const result: CleanupResult = {
      success: true,
      containersRemoved: [],
      errors: []
    };

    try {
      dockerLogger.info('Cleaning up all amplify containers');
      
      // List all containers with amplify label or name pattern
      const containers = await this.docker.listContainers({ 
        all: true,
        filters: {
          name: ['amplify-']
        }
      });

      dockerLogger.debug(`Found ${containers.length} amplify containers`);

      for (const containerInfo of containers) {
        const containerName = containerInfo.Names[0]?.replace(/^\//, '') || containerInfo.Id;
        const cleanupResult = await this.cleanupContainer(containerInfo.Id, options);
        
        // Merge results
        result.containersRemoved.push(...cleanupResult.containersRemoved);
        result.errors.push(...cleanupResult.errors);
        
        if (!cleanupResult.success) {
          result.success = false;
        }
      }

      if (result.success) {
        dockerLogger.info(`Successfully cleaned up ${result.containersRemoved.length} containers`);
      } else {
        dockerLogger.warn(`Cleanup completed with errors`, {
          removed: result.containersRemoved.length,
          errors: result.errors.length
        });
      }

    } catch (error: any) {
      dockerLogger.error('Error during bulk container cleanup', error);
      result.errors.push(`Bulk cleanup error: ${error.message}`);
      result.success = false;
    }

    return result;
  }

  /**
   * Set up cleanup handlers for graceful shutdown
   */
  setupCleanupHandlers(containerId: string): void {
    const cleanup = async () => {
      dockerLogger.info('Graceful shutdown initiated, cleaning up container...');
      try {
        await this.cleanupContainer(containerId, { force: true, timeout: 5 });
        dockerLogger.info('Container cleanup completed');
      } catch (error) {
        dockerLogger.error('Error during graceful cleanup', error);
      }
      process.exit(0);
    };

    // Handle various termination signals
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('SIGUSR1', cleanup);
    process.on('SIGUSR2', cleanup);
    
    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      dockerLogger.error('Uncaught exception, cleaning up', error);
      try {
        await this.cleanupContainer(containerId, { force: true, timeout: 2 });
      } catch (cleanupError) {
        dockerLogger.error('Error during emergency cleanup', cleanupError);
      }
      process.exit(1);
    });
  }
}

/**
 * Create a ContainerCleanup instance
 */
export function createContainerCleanup(): ContainerCleanup {
  return new ContainerCleanup();
}
