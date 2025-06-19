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
 * Store thread in history
 */
function addToThreadHistory(sessionData: DevSessionData): void {
  const history = getThreadHistory();
  const existingIndex = history.findIndex(t => t.sessionId === sessionData.sessionId);
  
  if (existingIndex >= 0) {
    // Update existing entry
    history[existingIndex] = { ...sessionData, lastAccessed: new Date().toISOString() };
  } else {
    // Add new entry
    history.push({ ...sessionData, lastAccessed: new Date().toISOString() });
  }
  
  // Keep only last 10 threads
  const sortedHistory = history.sort((a, b) => new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime());
  const trimmedHistory = sortedHistory.slice(0, 10);
  
  localStorage.setItem('dev-thread-history', JSON.stringify(trimmedHistory));
}

/**
 * Get thread history
 */
export function getThreadHistory(): Array<DevSessionData & { lastAccessed: string }> {
  try {
    const stored = localStorage.getItem('dev-thread-history');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
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
        addToThreadHistory(sessionData);
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
  
  // Store it for reuse and add to history
  localStorage.setItem('dev-session', JSON.stringify(newSession));
  addToThreadHistory(newSession);
  
  return newSession;
}

/**
 * Switch to an existing thread
 */
export async function switchToThread(sessionData: DevSessionData): Promise<DevSessionData> {
  // Validate the session is still active
  if (await validateSession(sessionData)) {
    localStorage.setItem('dev-session', JSON.stringify(sessionData));
    addToThreadHistory(sessionData);
    return sessionData;
  } else {
    throw new Error('Thread is no longer active');
  }
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
