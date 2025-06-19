import React, { useState, useEffect, useRef } from 'react';
import { getOrCreateDevSession, DevSessionData, isDevModeAvailable, clearDevSession, createDevSession, switchToThread } from '../../services/devSession';
import DevThreadInterface from './DevThreadInterface';

interface DevThreadViewProps {
  onError?: (error: Error) => void;
}

/**
 * Development wrapper for ThreadView that automatically creates a session
 */
export const DevThreadView: React.FC<DevThreadViewProps> = ({ onError }) => {
  const [devSession, setDevSession] = useState<DevSessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isDevMode, setIsDevMode] = useState<boolean>(false);
  const setupInProgress = useRef(false);

  useEffect(() => {
    const setupDevSession = async () => {
      // Prevent double execution in React Strict Mode
      if (setupInProgress.current) {
        return;
      }
      setupInProgress.current = true;

      try {
        setIsLoading(true);
        setError(null);

        // Check if dev mode is available
        const devModeAvailable = await isDevModeAvailable();
        setIsDevMode(devModeAvailable);

        if (!devModeAvailable) {
          throw new Error('Development mode not available - backend not running on localhost:3000');
        }

        // Get or create a development session
        const session = await getOrCreateDevSession();
        setDevSession(session);

        console.log('Development session ready:', session);

      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to setup development session');
        setError(error);
        onError?.(error);
        console.error('Failed to setup development session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    setupDevSession();
  }, [onError]);

  const handleNewThread = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Clear the old session
      clearDevSession();
      
      // Create a new session
      const newSession = await createDevSession();
      
      // Store it and add to history
      localStorage.setItem('dev-session', JSON.stringify(newSession));
      
      // Add to thread history manually since createDevSession doesn't do this
      const history = JSON.parse(localStorage.getItem('dev-thread-history') || '[]');
      const newHistoryEntry = { ...newSession, lastAccessed: new Date().toISOString() };
      const existingIndex = history.findIndex((t: any) => t.sessionId === newSession.sessionId);
      
      if (existingIndex >= 0) {
        history[existingIndex] = newHistoryEntry;
      } else {
        history.push(newHistoryEntry);
      }
      
      // Keep only last 10 threads
      const sortedHistory = history.sort((a: any, b: any) => new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime());
      const trimmedHistory = sortedHistory.slice(0, 10);
      localStorage.setItem('dev-thread-history', JSON.stringify(trimmedHistory));
      
      setDevSession(newSession);
      
      console.log('New development session created:', newSession);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create new thread');
      setError(error);
      onError?.(error);
      console.error('Failed to create new thread:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectThread = async (sessionData: DevSessionData) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const switchedSession = await switchToThread(sessionData);
      setDevSession(switchedSession);
      
      console.log('Switched to thread:', switchedSession.sessionId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to switch to thread');
      setError(error);
      onError?.(error);
      console.error('Failed to switch to thread:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="mb-4">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
          <p className="text-gray-600">Setting up development session...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <div className="mb-4 text-red-500">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Development Session Error
          </h3>
          <p className="text-gray-600 mb-4">
            {error.message}
          </p>
          {!isDevMode && (
            <p className="text-sm text-gray-500 mb-4">
              Make sure the backend server is running on localhost:3000
            </p>
          )}
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!devSession) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-600">No development session available</p>
        </div>
      </div>
    );
  }

  // Render the custom development thread interface
  console.log('DevThreadView: Rendering sessionId =', devSession.sessionId);
  return (
    <DevThreadInterface 
      sessionId={devSession.sessionId}
      onNewThread={handleNewThread}
      onSelectThread={handleSelectThread}
    />
  );
};

export default DevThreadView;
