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
 * Validate if a session is still active
 */
async function validateSession(sessionData: DevSessionData): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:3000/api/dev/thread/${sessionData.sessionId}/stats`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get or create a development session
 * Stores the session info in localStorage for reuse
 */
export async function getOrCreateDevSession(): Promise<DevSessionData> {
  // Try to reuse existing session
  const stored = localStorage.getItem('dev-session');
  if (stored) {
    try {
      const sessionData = JSON.parse(stored) as DevSessionData;
      if (await validateSession(sessionData)) {
        console.log('Reusing existing development session:', sessionData.sessionId);
        return sessionData;
      } else {
        console.log('Existing session is invalid, creating new one...');
        localStorage.removeItem('dev-session');
      }
    } catch {
      console.log('Failed to parse stored session, creating new one...');
      localStorage.removeItem('dev-session');
    }
  }
  
  console.log('Creating new development session...');
  
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
