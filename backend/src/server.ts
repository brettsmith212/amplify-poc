/**
 * New server entry point for web service mode (Phase 2)
 */

import { resolve } from 'path';
import { createWebApp } from './app';
import { logger } from './utils/logger';
import webConfig from './config/webConfig';

const serverLogger = logger.child('Server');

/**
 * Start the web service server
 */
async function startServer(): Promise<void> {
  try {
    serverLogger.info('Starting Amplify Phase 2 web service...', {
      version: process.env.npm_package_version || '0.1.0',
      nodeVersion: process.version,
      environment: webConfig.development.isDevelopment ? 'development' : 'production'
    });

    // Get project root (assuming we're in backend/dist or backend/src)
    const projectRoot = resolve(__dirname, '../../');
    
    // Create and configure web app
    const webApp = createWebApp({
      projectRoot,
      enableStaticServing: true,
      enableWebSocket: true
    });

    // Start the server
    const result = await webApp.start();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to start server');
    }

    serverLogger.info('🚀 Amplify Phase 2 web service started successfully!', {
      url: result.url,
      port: webConfig.server.port,
      host: webConfig.server.host
    });

    // Setup graceful shutdown
    setupGracefulShutdown(webApp);

  } catch (error) {
    serverLogger.error('Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Setup graceful shutdown handlers
 */
function setupGracefulShutdown(webApp: any): void {
  const gracefulShutdown = async (signal: string) => {
    serverLogger.info(`Received ${signal}, starting graceful shutdown...`);
    
    try {
      // Stop accepting new connections
      await webApp.stop();
      
      // Cleanup container manager
      const containerManager = webApp.getContainerManager();
      await containerManager.cleanup();
      
      serverLogger.info('Graceful shutdown completed');
      process.exit(0);
      
    } catch (error) {
      serverLogger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  };

  // Handle various shutdown signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    serverLogger.error('Uncaught exception:', error);
    gracefulShutdown('uncaughtException').catch(() => process.exit(1));
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    serverLogger.error('Unhandled rejection:', { promise, reason });
    gracefulShutdown('unhandledRejection').catch(() => process.exit(1));
  });
}

// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}

export { startServer };
