/**
 * Express server with Vite dev middleware and static build serving
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { setupVite, getStaticMiddleware, createSpaHandler, ViteConfig } from './viteConfig';
import {
  requestLogger,
  corsMiddleware,
  healthCheck,
  errorHandler,
  notFoundHandler,
  securityHeaders,
  jsonParseErrorHandler,
  createRateLimiter
} from './middleware';
import { logger } from '../utils/logger';
import { TerminalBridge } from '../websocket/terminalBridge';
import { DockerExecManager } from '../docker/execManager';

const serverLogger = logger.child('WebServer');

export interface WebServerConfig {
  port: number;
  host: string;
  projectRoot: string;
  execManager?: DockerExecManager;
}

export interface WebServerResult {
  success: boolean;
  server?: any;
  url?: string;
  error?: string;
}

export class WebServer {
  private app: express.Application;
  private server?: any;
  private config: WebServerConfig;
  private viteConfig?: ViteConfig;
  private wss?: WebSocketServer;
  private terminalBridge?: TerminalBridge;

  constructor(config: WebServerConfig) {
    this.config = config;
    this.app = express();
  }

  /**
   * Initialize and start the web server
   */
  async start(): Promise<WebServerResult> {
    try {
      serverLogger.info('Starting web server...', {
        port: this.config.port,
        host: this.config.host,
        projectRoot: this.config.projectRoot
      });

      // Setup Vite configuration
      const viteSetup = await setupVite(this.config.projectRoot);
      if (!viteSetup.success || !viteSetup.config) {
        return {
          success: false,
          error: viteSetup.error || 'Failed to setup Vite'
        };
      }
      
      this.viteConfig = viteSetup.config;
      
      // Setup Express middleware
      await this.setupMiddleware();
      
      // Setup routes
      this.setupRoutes();
      
      // Setup error handling
      this.setupErrorHandling();
      
      // Create HTTP server
      this.server = createServer(this.app);
      
      // Setup WebSocket server
      this.setupWebSocket();
      
      // Start listening
      await this.listen();
      
      const url = `http://${this.config.host}:${this.config.port}`;
      serverLogger.info('Web server started successfully', {
        url,
        mode: this.viteConfig.isDevelopment ? 'development' : 'production'
      });
      
      return {
        success: true,
        server: this.server,
        url
      };
      
    } catch (error: any) {
      serverLogger.error('Failed to start web server', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Stop the web server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      // Clean up WebSocket connections
      if (this.terminalBridge) {
        this.terminalBridge.cleanupAll();
      }
      
      if (this.wss) {
        this.wss.close();
      }
      
      if (this.server) {
        serverLogger.info('Stopping web server...');
        this.server.close(() => {
          serverLogger.info('Web server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get the Express app instance
   */
  getApp(): express.Application {
    return this.app;
  }

  /**
   * Get the HTTP server instance
   */
  getServer(): any {
    return this.server;
  }

  /**
   * Setup Express middleware
   */
  private async setupMiddleware(): Promise<void> {
    if (!this.viteConfig) {
      throw new Error('Vite config not initialized');
    }

    // Trust proxy in production (for rate limiting, etc.)
    this.app.set('trust proxy', 1);
    
    // Security headers
    this.app.use(securityHeaders);
    
    // Request logging
    this.app.use(requestLogger);
    
    // CORS for development
    if (this.viteConfig.isDevelopment) {
      this.app.use(corsMiddleware);
    }
    
    // Rate limiting (more permissive in development)
    const rateLimiter = this.viteConfig.isDevelopment 
      ? createRateLimiter(60000, 1000) // 1000 req/min in dev
      : createRateLimiter(60000, 100);  // 100 req/min in prod
    this.app.use(rateLimiter);
    
    // JSON body parser with error handling
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(jsonParseErrorHandler);
    
    // URL encoded body parser
    this.app.use(express.urlencoded({ extended: true }));
    
    serverLogger.info('Express middleware configured', {
      isDevelopment: this.viteConfig.isDevelopment
    });
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    if (!this.viteConfig) {
      throw new Error('Vite config not initialized');
    }

    // Health check endpoint
    this.app.get('/api/health', healthCheck);
    
    // API routes placeholder
    this.app.get('/api/status', (req, res) => {
      res.json({
        status: 'running',
        mode: this.viteConfig?.isDevelopment ? 'development' : 'production',
        timestamp: new Date().toISOString(),
        container: {
          ready: false // Will be updated when container management is integrated
        }
      });
    });
    
    // WebSocket info endpoint
    this.app.get('/api/ws', (req, res) => {
      res.json({
        message: 'WebSocket terminal available at ws://localhost:' + this.config.port + '/ws',
        activeConnections: this.terminalBridge?.getActiveSessionCount() || 0,
        ready: !!this.terminalBridge
      });
    });
    
    // Static file serving (Vite dev server or built files)
    const staticMiddleware = getStaticMiddleware(this.viteConfig);
    this.app.use(staticMiddleware);
    
    // SPA routing handler (must be last)
    this.app.use(createSpaHandler(this.viteConfig));
    
    serverLogger.info('Routes configured');
  }

  /**
   * Setup WebSocket server
   */
  private setupWebSocket(): void {
    if (!this.server) {
      throw new Error('HTTP server not initialized');
    }

    // Create WebSocket server
    this.wss = new WebSocketServer({
      server: this.server,
      path: '/ws'
    });

    // Initialize terminal bridge if exec manager is available
    if (this.config.execManager) {
      this.terminalBridge = new TerminalBridge(this.config.execManager);

      this.wss.on('connection', async (ws, request) => {
        try {
          const sessionId = await this.terminalBridge!.handleConnection(ws);
          serverLogger.info(`WebSocket terminal connection established: ${sessionId}`, {
            clientIp: request.socket.remoteAddress,
            userAgent: request.headers['user-agent']
          });
        } catch (error) {
          serverLogger.error('Failed to handle WebSocket connection:', error);
          ws.close();
        }
      });

      // Set up periodic ping to keep connections alive
      const pingInterval = setInterval(() => {
        if (this.terminalBridge) {
          this.terminalBridge.pingAllSessions();
        }
      }, 30000); // Ping every 30 seconds

      this.wss.on('close', () => {
        clearInterval(pingInterval);
      });

      serverLogger.info('WebSocket server configured with terminal bridge');
    } else {
      serverLogger.warn('WebSocket server configured without exec manager - terminal functionality disabled');
    }
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    // 404 handler for API routes
    this.app.use('/api/*', notFoundHandler);
    
    // General error handler
    this.app.use(errorHandler);
    
    serverLogger.info('Error handling configured');
  }

  /**
   * Start listening on the configured port
   */
  private async listen(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        reject(new Error('Server not initialized'));
        return;
      }
      
      this.server.listen(this.config.port, this.config.host, () => {
        resolve();
      });
      
      this.server.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          reject(new Error(`Port ${this.config.port} is already in use`));
        } else {
          reject(error);
        }
      });
    });
  }
}

/**
 * Create and start a web server with default configuration
 */
export async function createWebServer(projectRoot: string, port: number = 3000): Promise<WebServerResult> {
  const config: WebServerConfig = {
    port,
    host: 'localhost',
    projectRoot
  };
  
  const webServer = new WebServer(config);
  return await webServer.start();
}
