import { logger } from '../utils/logger';
import { createContainerManager } from '../docker/containerManager';
import { AmplifyErrorHandler } from '../utils/errorHandler';

export interface CleanupResource {
  id: string;
  type: 'container' | 'network' | 'volume' | 'server';
  cleanup: () => Promise<void>;
  description: string;
}

export class CleanupManager {
  private resources: Map<string, CleanupResource> = new Map();
  private isShuttingDown = false;
  private cleanupPromise?: Promise<void>;

  /**
   * Register a resource for cleanup
   */
  registerResource(resource: CleanupResource): void {
    this.resources.set(resource.id, resource);
    logger.debug(`Registered cleanup resource: ${resource.description}`);
  }

  /**
   * Unregister a resource (when it's already cleaned up)
   */
  unregisterResource(id: string): void {
    const resource = this.resources.get(id);
    if (resource) {
      this.resources.delete(id);
      logger.debug(`Unregistered cleanup resource: ${resource.description}`);
    }
  }

  /**
   * Get all registered resources
   */
  getResources(): CleanupResource[] {
    return Array.from(this.resources.values());
  }

  /**
   * Gracefully shutdown all resources
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      // If shutdown is already in progress, wait for it
      return this.cleanupPromise;
    }

    this.isShuttingDown = true;
    this.cleanupPromise = this.performShutdown();
    return this.cleanupPromise;
  }

  private async performShutdown(): Promise<void> {
    const resources = this.getResources();
    
    if (resources.length === 0) {
      logger.info('No resources to clean up');
      return;
    }

    logger.info(`🛑 Gracefully shutting down ${resources.length} resource(s)...`);

    // Group resources by type for proper shutdown order
    const containers = resources.filter(r => r.type === 'container');
    const servers = resources.filter(r => r.type === 'server');
    const networks = resources.filter(r => r.type === 'network');
    const volumes = resources.filter(r => r.type === 'volume');

    const cleanupOrder = [servers, containers, networks, volumes];
    const results: { resource: CleanupResource; success: boolean; error?: Error }[] = [];

    // Cleanup in order with parallel execution within each type
    for (const resourceGroup of cleanupOrder) {
      if (resourceGroup.length === 0) continue;

      const groupResults = await Promise.allSettled(
        resourceGroup.map(async (resource) => {
          try {
            logger.info(`Cleaning up: ${resource.description}`);
            await resource.cleanup();
            this.unregisterResource(resource.id);
            return { resource, success: true };
          } catch (error) {
            logger.error(`Failed to cleanup ${resource.description}:`, error);
            return { 
              resource, 
              success: false, 
              error: error instanceof Error ? error : new Error(String(error))
            };
          }
        })
      );

      // Collect results
      groupResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            resource: { id: 'unknown', type: 'container', cleanup: async () => {}, description: 'unknown' },
            success: false,
            error: result.reason
          });
        }
      });
    }

    // Report results
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    if (failed === 0) {
      AmplifyErrorHandler.success(`All ${successful} resource(s) cleaned up successfully`);
    } else {
      AmplifyErrorHandler.warn(
        `Cleanup completed with ${failed} failure(s) out of ${results.length} resource(s)`,
        failed > 0 ? [
          'Some resources may still be running',
          'Check for orphaned Docker containers: docker ps -a',
          'Manual cleanup may be required: docker container prune'
        ] : undefined
      );
    }

    logger.info('Cleanup process completed');
  }

  /**
   * Emergency cleanup - force cleanup without waiting
   */
  async emergencyCleanup(): Promise<void> {
    logger.warn('🚨 Performing emergency cleanup...');
    
    const resources = this.getResources();
    
    // Try to cleanup all resources in parallel with short timeout
    const cleanupPromises = resources.map(async (resource) => {
      try {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Cleanup timeout')), 5000)
        );
        
        await Promise.race([resource.cleanup(), timeoutPromise]);
        logger.debug(`Emergency cleanup successful: ${resource.description}`);
      } catch (error) {
        logger.error(`Emergency cleanup failed: ${resource.description}`, error);
      }
    });

    await Promise.allSettled(cleanupPromises);
    this.resources.clear();
    logger.warn('Emergency cleanup completed');
  }

  /**
   * Create a container cleanup resource
   */
  static createContainerResource(containerId: string, sessionId?: string): CleanupResource {
    return {
      id: `container-${containerId}`,
      type: 'container',
      description: `Docker container ${containerId.substring(0, 12)}${sessionId ? ` (${sessionId})` : ''}`,
      cleanup: async () => {
        const containerManager = createContainerManager();
        
        try {
          // Try to stop gracefully first
          await containerManager.stopContainer(containerId);
          logger.debug(`Container ${containerId.substring(0, 12)} stopped`);
        } catch (error) {
          logger.debug(`Container stop failed, trying cleanup: ${error}`);
        }

        try {
          // Clean up the container
          const success = await containerManager.cleanupContainer(containerId);
          if (!success) {
            throw new Error('Container cleanup returned false');
          }
          logger.debug(`Container ${containerId.substring(0, 12)} cleaned up`);
        } catch (error) {
          logger.error(`Container cleanup failed: ${error}`);
          throw error;
        }
      }
    };
  }

  /**
   * Create a web server cleanup resource
   */
  static createServerResource(serverId: string, server: any): CleanupResource {
    return {
      id: `server-${serverId}`,
      type: 'server',
      description: `Web server ${serverId}`,
      cleanup: async () => {
        if (server && typeof server.stop === 'function') {
          await server.stop();
          logger.debug(`Server ${serverId} stopped`);
        } else if (server && typeof server.close === 'function') {
          await new Promise<void>((resolve, reject) => {
            server.close((error: Error) => {
              if (error) reject(error);
              else resolve();
            });
          });
          logger.debug(`Server ${serverId} closed`);
        }
      }
    };
  }
}

// Global cleanup manager instance
export const globalCleanupManager = new CleanupManager();

/**
 * Convenience function to register container for cleanup
 */
export function registerContainerCleanup(containerId: string, sessionId?: string): void {
  const resource = CleanupManager.createContainerResource(containerId, sessionId);
  globalCleanupManager.registerResource(resource);
}

/**
 * Convenience function to register server for cleanup
 */
export function registerServerCleanup(serverId: string, server: any): void {
  const resource = CleanupManager.createServerResource(serverId, server);
  globalCleanupManager.registerResource(resource);
}

/**
 * Convenience function to perform graceful shutdown
 */
export async function gracefulShutdown(): Promise<void> {
  return globalCleanupManager.shutdown();
}

/**
 * Convenience function to perform emergency cleanup
 */
export async function emergencyCleanup(): Promise<void> {
  return globalCleanupManager.emergencyCleanup();
}
