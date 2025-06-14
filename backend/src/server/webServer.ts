/**
 * Express server with Vite dev middleware and static build serving
 */

import express from 'express';
import { createServer } from 'http';
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

const serverLogger = logger.child('WebServer');

export interface WebServerConfig {
  port: number;
  host: string;
  projectRoot: string;
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
    
    // WebSocket upgrade endpoint (placeholder for Step 7)
    this.app.get('/api/ws', (req, res) => {
      res.status(501).json({
        error: {
          message: 'WebSocket support not implemented yet',
          implementedIn: 'Step 7: WebSocket Bridge'
        }
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
