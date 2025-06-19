/**
 * Development-only service for creating and managing sessions without authentication
 */

export interface DevSessionData {
  sessionId: string;
  threadId: string;
  ampLogPath: string;
}

/**
 * Create a development session with thread
 */
export async function createDevSession(): Promise<DevSessionData> {
  const response = await fetch('http://localhost:3000/api/dev/thread/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to create dev session: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(`Failed to create dev session: ${data.error || data.message}`);
  }

  return {
    sessionId: data.sessionId,
    threadId: data.threadId,
    ampLogPath: data.ampLogPath
  };
}

/**
 * Get or create a development session
 * Stores the session info in localStorage for reuse
 */
export async function getOrCreateDevSession(): Promise<DevSessionData> {
  // Check if we have a stored dev session
  const stored = localStorage.getItem('dev-session');
  if (stored) {
    try {
      const data = JSON.parse(stored) as DevSessionData;
      
      // Verify the session still exists
      const response = await fetch(`http://localhost:3000/api/dev/thread/${data.sessionId}/stats`);
      if (response.ok) {
        return data;
      }
    } catch (error) {
      console.warn('Stored dev session is invalid, creating new one');
    }
  }

  // Create a new session
  const newSession = await createDevSession();
  
  // Store it for reuse
  localStorage.setItem('dev-session', JSON.stringify(newSession));
  
  return newSession;
}

/**
 * Clear the stored development session
 */
export function clearDevSession(): void {
  localStorage.removeItem('dev-session');
}

/**
 * Check if development mode is available
 */
export async function isDevModeAvailable(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:3000/api/health');
    if (!response.ok) return false;
    
    const data = await response.json();
    return data.service === 'amplify-backend';
  } catch {
    return false;
  }
}
