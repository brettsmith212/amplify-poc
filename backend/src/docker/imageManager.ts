/**
 * Docker image management - handles checking, building, and managing the amplify-base image
 */

import Docker from 'dockerode';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import {
  DockerImageInfo,
  ImageBuildOptions,
  ImageInspectResult,
  ImageBuildResult,
  DockerManagerConfig
} from './types';
import { dockerLogger } from '../utils/logger';

export class ImageManager {
  private docker: Docker;
  private config: DockerManagerConfig;

  constructor(config: DockerManagerConfig) {
    this.docker = new Docker();
    this.config = config;
  }

  /**
   * Check if the amplify-base image exists
   */
  async inspectImage(): Promise<ImageInspectResult> {
    try {
      dockerLogger.debug(`Inspecting image: ${this.config.baseImageName}`);
      
      const image = this.docker.getImage(this.config.baseImageName);
      const imageInfo = await image.inspect();
      
      const dockerImageInfo: DockerImageInfo = {
        id: imageInfo.Id,
        tags: imageInfo.RepoTags || [],
        size: imageInfo.Size,
        created: imageInfo.Created,
        repoTags: imageInfo.RepoTags
      };

      dockerLogger.info(`Image ${this.config.baseImageName} found`, {
        id: dockerImageInfo.id.substring(0, 12),
        size: this.formatBytes(dockerImageInfo.size),
        created: dockerImageInfo.created
      });

      return {
        exists: true,
        imageInfo: dockerImageInfo
      };
    } catch (error: any) {
      if (error.statusCode === 404) {
        dockerLogger.info(`Image ${this.config.baseImageName} not found`);
        return { exists: false };
      }

      dockerLogger.error(`Error inspecting image ${this.config.baseImageName}`, error);
      return {
        exists: false,
        error: error.message
      };
    }
  }

  /**
   * Build the amplify-base image using docker build command
   */
  async buildImage(): Promise<ImageBuildResult> {
    try {
      dockerLogger.info(`Building image: ${this.config.baseImageName}`);
      
      // Verify Dockerfile exists
      const dockerfilePath = join(this.config.projectRoot, this.config.dockerfilePath);
      await fs.access(dockerfilePath);
      
      const buildOptions: ImageBuildOptions = {
        imageName: this.config.baseImageName,
        dockerfilePath: this.config.dockerfilePath,
        contextPath: this.config.projectRoot
      };

      const result = await this.executeDockerBuild(buildOptions);
      
      if (result.success) {
        dockerLogger.info(`Successfully built image: ${this.config.baseImageName}`, {
          imageId: result.imageId
        });
      } else {
        dockerLogger.error(`Failed to build image: ${this.config.baseImageName}`, {
          error: result.error
        });
      }
      
      return result;
    } catch (error: any) {
      dockerLogger.error(`Error building image: ${this.config.baseImageName}`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Ensure the amplify-base image exists, build it if missing
   */
  async ensureImage(): Promise<ImageInspectResult> {
    dockerLogger.info('Ensuring amplify-base image is available');
    
    // First, check if image exists
    const inspectResult = await this.inspectImage();
    
    if (inspectResult.exists) {
      dockerLogger.info('Image already exists, no build needed');
      return inspectResult;
    }

    // Image doesn't exist, build it
    dockerLogger.info('Image not found, building...');
    const buildResult = await this.buildImage();
    
    if (!buildResult.success) {
      return {
        exists: false,
        error: `Failed to build image: ${buildResult.error}`
      };
    }

    // Verify the build succeeded by inspecting again
    return await this.inspectImage();
  }

  /**
   * Execute docker build command using child process for better output streaming
   */
  private async executeDockerBuild(options: ImageBuildOptions): Promise<ImageBuildResult> {
    return new Promise((resolve) => {
      const args = [
        'build',
        '-t', options.imageName,
        '-f', options.dockerfilePath,
        options.contextPath
      ];

      // Add build args if provided
      if (options.buildArgs) {
        for (const [key, value] of Object.entries(options.buildArgs)) {
          args.push('--build-arg', `${key}=${value}`);
        }
      }

      dockerLogger.debug('Executing docker build', { args });

      const buildProcess = spawn('docker', args, {
        cwd: options.contextPath,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const buildLogs: string[] = [];
      let imageId: string | undefined;

      buildProcess.stdout.on('data', (data: Buffer) => {
        const output = data.toString();
        buildLogs.push(output);
        
        // Extract image ID from successful build output
        const imageIdMatch = output.match(/writing image sha256:([a-f0-9]+)/);
        if (imageIdMatch) {
          imageId = imageIdMatch[1];
        }
        
        // Log build progress (only significant lines)
        const lines = output.split('\n').filter(line => line.trim());
        for (const line of lines) {
          if (line.includes('=>') || line.includes('STEP') || line.includes('Successfully')) {
            dockerLogger.debug(`Build: ${line.trim()}`);
          }
        }
      });

      buildProcess.stderr.on('data', (data: Buffer) => {
        const output = data.toString();
        buildLogs.push(output);
        dockerLogger.debug(`Build stderr: ${output.trim()}`);
      });

      buildProcess.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            imageId,
            buildLogs
          });
        } else {
          resolve({
            success: false,
            error: `Docker build failed with exit code ${code}`,
            buildLogs
          });
        }
      });

      buildProcess.on('error', (error) => {
        resolve({
          success: false,
          error: `Failed to start docker build: ${error.message}`,
          buildLogs
        });
      });
    });
  }

  /**
   * Format bytes to human readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get Docker daemon info for debugging
   */
  async getDockerInfo(): Promise<any> {
    try {
      return await this.docker.info();
    } catch (error) {
      dockerLogger.error('Failed to get Docker info', error);
      return null;
    }
  }

  /**
   * Check if Docker is available and running
   */
  async isDockerAvailable(): Promise<boolean> {
    try {
      await this.docker.ping();
      return true;
    } catch (error) {
      dockerLogger.error('Docker is not available', error);
      return false;
    }
  }
}

/**
 * Create an ImageManager instance with default configuration
 */
export function createImageManager(projectRoot: string): ImageManager {
  const config: DockerManagerConfig = {
    baseImageName: 'amplify-base',
    dockerfilePath: 'Dockerfile.base',
    projectRoot
  };

  return new ImageManager(config);
}
