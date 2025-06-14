import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface BrowserLaunchResult {
  success: boolean;
  error?: string;
}

export async function launchBrowser(url: string): Promise<BrowserLaunchResult> {
  try {
    const platform = process.platform;
    let command: string;

    switch (platform) {
      case 'darwin': // macOS
        command = `open "${url}"`;
        break;
      case 'win32': // Windows
        command = `start "" "${url}"`;
        break;
      case 'linux': // Linux
        command = `xdg-open "${url}"`;
        break;
      default:
        return {
          success: false,
          error: `Unsupported platform: ${platform}. Please manually navigate to ${url}`
        };
    }

    await execAsync(command);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to launch browser: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

export async function waitForServerReady(url: string, maxAttempts: number = 30, intervalMs: number = 100): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(url, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(1000) 
      });
      if (response.ok) {
        return true;
      }
    } catch (error) {
      // Server not ready yet, continue waiting
    }
    
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  
  return false;
}

export async function launchBrowserWhenReady(url: string): Promise<BrowserLaunchResult> {
  const isServerReady = await waitForServerReady(url);
  
  if (!isServerReady) {
    return {
      success: false,
      error: 'Server failed to start within the expected time. Please manually navigate to ' + url
    };
  }

  return await launchBrowser(url);
}
