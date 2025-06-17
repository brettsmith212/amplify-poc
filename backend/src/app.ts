/**
 * Express app configuration for Phase 2 web service
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import helmet from 'helmet';
import passport from 'passport';

import webConfig, { validateConfig } from './config/webConfig';
import { sessionStore } from './services/sessionStore';
import { CleanupService } from './services/cleanup';
import { ContainerManager } from './docker/containerManager';
import { DockerExecManager } from './docker/execManager';
import { TerminalBridge } from './websocket/terminalBridge';
import { logger } from './utils/logger';

import {
  requestLogger,
  corsMiddleware,
  healthCheck,
  errorHandler,
  notFoundHandler,
  securityHeaders,
  jsonParseErrorHandler,
  createRateLimiter
} from './server/middleware';

import { authenticateUser, logAuthEvents } from './middleware/auth';
import authRoutes from './routes/auth';
import githubRoutes from './routes/github';
import sessionRoutes from './routes/sessions';
import gitRoutes from './routes/git';
import diffRoutes from './routes/diff';

const appLogger = logger.child('WebApp');

export interface WebAppOptions {
  projectRoot: string;
  enableStaticServing?: boolean;
  enableWebSocket?: boolean;
}

export class WebApp {
  private app: express.Application;
  private server?: any;
  private wss?: WebSocketServer;
  private terminalBridge?: TerminalBridge;
  private containerManager: ContainerManager;
  private cleanupService: CleanupService;
  private options: WebAppOptions;

  constructor(options: WebAppOptions) {
    this.options = options;
    this.app = express();
    
    // Initialize core services
    this.containerManager = new ContainerManager();
    this.cleanupService = new CleanupService(sessionStore, this.containerManager);
    
    this.initializeApp();
  }

  /**
   * Initialize the Express application with middleware and routes
   */
  private initializeApp(): void {
    // Validate configuration
    const validation = validateConfig();
    if (!validation.isValid) {
      appLogger.error('Configuration validation failed:', validation.errors);
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    // Trust proxy settings
    if (webConfig.server.trustProxy) {
      this.app.set('trust proxy', 1);
    }

    // Security middleware
    if (!webConfig.development.isDevelopment) {
      this.app.use(helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-eval'"], // Required for Vite in dev
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "ws:", "wss:"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"]
          }
        }
      }));
    }
    
    // Compression middleware
    this.app.use(compression());
    
    // Cookie parser
    this.app.use(cookieParser(webConfig.security.cookieSecret));
    
    // Passport initialization
    this.app.use(passport.initialize());
    
    // Request logging
    this.app.use(requestLogger);
    
    // CORS middleware
    this.app.use(corsMiddleware);
    
    // Rate limiting
    const rateLimiter = createRateLimiter(
      webConfig.security.rateLimiting.windowMs,
      webConfig.security.rateLimiting.maxRequests
    );
    this.app.use(rateLimiter);
    
    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(jsonParseErrorHandler);
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Authentication middleware (optional - adds user to req if authenticated)
    this.app.use(authenticateUser);
    
    // Authentication event logging
    this.app.use(logAuthEvents);
    
    // Setup routes
    this.setupRoutes();
    
    // Setup error handling
    this.setupErrorHandling();

    appLogger.info('WebApp initialized', {
      environment: webConfig.development.isDevelopment ? 'development' : 'production',
      port: webConfig.server.port,
      host: webConfig.server.host
    });
  }

  /**
   * Setup application routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/api/health', healthCheck);
    
    // System status endpoint
    this.app.get('/api/status', (req, res) => {
      const sessionStats = sessionStore.getStats();
      const cleanupStats = this.cleanupService.getStats();
      
      res.json({
        status: 'running',
        environment: webConfig.development.isDevelopment ? 'development' : 'production',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '0.1.0',
        sessions: sessionStats,
        cleanup: cleanupStats,
        uptime: process.uptime()
      });
    });

    // Configuration endpoint (safe subset)
    this.app.get('/api/config', (req, res) => {
      res.json({
        server: {
          port: webConfig.server.port,
          host: webConfig.server.host
        },
        session: {
          defaultTTL: webConfig.session.defaultTTL,
          maxSessionsPerUser: webConfig.session.maxSessionsPerUser
        },
        github: {
          clientId: webConfig.github.clientId,
          callbackUrl: webConfig.github.callbackUrl,
          scopes: webConfig.github.scopes
        },
        development: webConfig.development
      });
    });

    // Authentication routes
    this.app.use('/auth', authRoutes);
    
    // GitHub API routes
    this.app.use('/api/github', githubRoutes);
    
    // Session management routes
    this.app.use('/api/sessions', sessionRoutes);
    
    // Git operation routes
    this.app.use('/api/sessions', gitRoutes);
    
    // Diff routes for Monaco editor
    this.app.use('/api/sessions', diffRoutes);

    appLogger.info('Routes configured');
  }

  /**
   * Setup WebSocket server for terminal connections
   */
  private setupWebSocket(): void {
    if (!this.server || !this.options.enableWebSocket) {
      return;
    }

    // Create WebSocket server (no path restriction to handle /ws/:sessionId)
    this.wss = new WebSocketServer({
      server: this.server
    });

    // Create default Docker exec manager for fallback
    const Docker = require('dockerode');
    const docker = new Docker();
    const defaultExecManager = new DockerExecManager(docker, 'default-container');

    // Initialize terminal bridge
    this.terminalBridge = new TerminalBridge(defaultExecManager);

    this.wss.on('connection', async (ws, request) => {
      try {
        // Only handle WebSocket connections for /ws paths
        const url = request.url || '';
        if (!url.startsWith('/ws')) {
          appLogger.warn('WebSocket connection attempted on non-/ws path', { url });
          ws.close();
          return;
        }

        // Extract session ID from URL path: /ws/:sessionId
        const sessionIdMatch = url.match(/^\/ws\/([^/?]+)/);
        const sessionId = sessionIdMatch ? sessionIdMatch[1] : undefined;

        const clientInfo = {
          ...(request.socket.remoteAddress && { remoteAddress: request.socket.remoteAddress }),
          ...(request.headers['user-agent'] && { userAgent: request.headers['user-agent'] })
        };

        const actualSessionId = await this.terminalBridge!.handleConnection(
          ws, 
          sessionId, 
          clientInfo
        );
        
        appLogger.info(`WebSocket terminal connection established: ${actualSessionId}`, {
          requestedSessionId: sessionId,
          clientIp: request.socket.remoteAddress,
          userAgent: request.headers['user-agent']
        });
      } catch (error) {
        appLogger.error('Failed to handle WebSocket connection:', error);
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

    appLogger.info('WebSocket server configured with terminal bridge');
  }

  /**
   * Setup error handling middleware
   */
  private setupErrorHandling(): void {
    // 404 handler for API routes
    this.app.use('/api/*', notFoundHandler);
    
    // Global error handler
    this.app.use(errorHandler);
    
    appLogger.info('Error handling configured');
  }

  /**
   * Start the web application server
   */
  async start(): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      // Start cleanup service
      this.cleanupService.start();

      // Create HTTP server
      this.server = createServer(this.app);

      // Setup WebSocket if enabled
      if (this.options.enableWebSocket) {
        this.setupWebSocket();
      }

      // Start listening
      await new Promise<void>((resolve, reject) => {
        this.server.listen(webConfig.server.port, webConfig.server.host, () => {
          resolve();
        });
        
        this.server.on('error', (error: any) => {
          if (error.code === 'EADDRINUSE') {
            reject(new Error(`Port ${webConfig.server.port} is already in use`));
          } else {
            reject(error);
          }
        });
      });

      const url = `http://${webConfig.server.host}:${webConfig.server.port}`;
      appLogger.info('WebApp started successfully', { url });

      return { success: true, url };

    } catch (error: any) {
      appLogger.error('Failed to start WebApp:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Stop the web application server
   */
  async stop(): Promise<void> {
    appLogger.info('Stopping WebApp...');

    // Stop cleanup service
    this.cleanupService.stop();

    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
    }

    // Close HTTP server
    if (this.server) {
      await new Promise<void>(resolve => {
        this.server.close(() => {
          appLogger.info('WebApp stopped');
          resolve();
        });
      });
    }
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
   * Get the container manager instance
   */
  getContainerManager(): ContainerManager {
    return this.containerManager;
  }

  /**
   * Get the cleanup service instance
   */
  getCleanupService(): CleanupService {
    return this.cleanupService;
  }
}

/**
 * Create and configure a new WebApp instance
 */
export function createWebApp(options: WebAppOptions): WebApp {
  return new WebApp(options);
}
