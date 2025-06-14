/**
 * Vite integration utilities for dev vs production mode
 */

import { resolve, join } from 'path';
import { existsSync } from 'fs';
import { logger } from '../utils/logger';

export interface ViteConfig {
  isDevelopment: boolean;
  frontendDir: string;
  frontendDistDir: string;
  viteDevServer?: any;
}

export interface ViteSetupResult {
  success: boolean;
  config?: ViteConfig;
  error?: string;
}

/**
 * Determine if we should run in development mode
 */
export function isDevelopmentMode(): boolean {
  // Check if NODE_ENV is set to development
  if (process.env.NODE_ENV === 'development') {
    return true;
  }
  
  // Check if we're running from ts-node (development)
  if (process.env.TS_NODE_DEV || (process.argv[0] && process.argv[0].includes('ts-node'))) {
    return true;
  }
  
  // Default to production
  return false;
}

/**
 * Get frontend directory paths
 */
export function getFrontendPaths(projectRoot: string) {
  const frontendDir = resolve(projectRoot, 'frontend');
  const frontendDistDir = resolve(frontendDir, 'dist');
  
  return {
    frontendDir,
    frontendDistDir
  };
}

/**
 * Setup Vite configuration based on environment
 */
export async function setupVite(projectRoot: string): Promise<ViteSetupResult> {
  try {
    const isDev = isDevelopmentMode();
    const { frontendDir, frontendDistDir } = getFrontendPaths(projectRoot);
    
    logger.info(`Setting up Vite in ${isDev ? 'development' : 'production'} mode`, {
      frontendDir,
      isDev
    });
    
    // Verify frontend directory exists
    if (!existsSync(frontendDir)) {
      return {
        success: false,
        error: `Frontend directory not found: ${frontendDir}`
      };
    }
    
    let viteDevServer;
    
    if (isDev) {
      // In development, we'll proxy to Vite dev server
      viteDevServer = await setupViteDevServer(frontendDir);
      if (!viteDevServer) {
        return {
          success: false,
          error: 'Failed to setup Vite dev server'
        };
      }
    } else {
      // In production, verify dist directory exists
      if (!existsSync(frontendDistDir)) {
        return {
          success: false,
          error: `Frontend build directory not found: ${frontendDistDir}. Run 'cd frontend && npm run build' first.`
        };
      }
    }
    
    const config: ViteConfig = {
      isDevelopment: isDev,
      frontendDir,
      frontendDistDir,
      viteDevServer
    };
    
    return {
      success: true,
      config
    };
    
  } catch (error: any) {
    logger.error('Error setting up Vite', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Setup Vite dev server for development mode
 */
async function setupViteDevServer(frontendDir: string): Promise<any> {
  try {
    // Dynamically import Vite (only available in development)
    let createServer;
    try {
      const vite = await import('vite');
      createServer = vite.createServer;
    } catch (importError) {
      logger.warn('Vite not available, falling back to static serving');
      return null;
    }
    
    const server = await createServer({
      root: frontendDir,
      server: {
        middlewareMode: true,
        hmr: {
          port: 24678 // Use a different port for HMR to avoid conflicts
        }
      },
      appType: 'spa'
    });
    
    logger.info('Vite dev server created successfully', {
      root: frontendDir,
      hmrPort: 24678
    });
    
    return server;
  } catch (error: any) {
    logger.error('Failed to create Vite dev server', error);
    return null;
  }
}

/**
 * Get the appropriate static middleware for serving frontend
 */
export function getStaticMiddleware(config: ViteConfig) {
  if (config.isDevelopment && config.viteDevServer) {
    // Return Vite dev middleware
    return config.viteDevServer.middlewares;
  } else {
    // Return express.static for built files
    const express = require('express');
    return express.static(config.frontendDistDir, {
      index: 'index.html',
      fallthrough: false
    });
  }
}

/**
 * Handle SPA routing for both dev and production
 */
export function createSpaHandler(config: ViteConfig) {
  return (req: any, res: any, next: any) => {
    // Only handle GET requests for non-API routes
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/ws')) {
      return next();
    }
    
    // Check if it's a file request (has extension)
    const isFileRequest = /\.[^/]+$/.test(req.path);
    if (isFileRequest) {
      return next();
    }
    
    if (config.isDevelopment && config.viteDevServer) {
      // In development, let Vite handle SPA routing
      req.url = '/';
      config.viteDevServer.middlewares(req, res, next);
    } else {
      // In production, serve index.html for SPA routes
      const path = require('path');
      res.sendFile(path.join(config.frontendDistDir, 'index.html'));
    }
  };
}
