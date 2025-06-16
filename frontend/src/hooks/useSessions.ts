import { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';

export interface Session {
  id: string;
  userId: string;
  repositoryUrl: string;
  repositoryName: string;
  branch: string;
  initialPrompt: string;
  status: SessionStatus;
  containerId?: string;
  containerName?: string;
  createdAt: string;
  lastAccessedAt: string;
  expiresAt: string;
  metadata: SessionMetadata;
}

export enum SessionStatus {
  CREATING = 'creating',
  READY = 'ready',
  RUNNING = 'running',
  IDLE = 'idle',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error'
}

export interface SessionMetadata {
  gitCommitHash?: string;
  workspaceSize?: number;
  lastCommand?: string;
  errorCount?: number;
  connectionCount?: number;
  tags?: string[];
}

export interface SessionSummary {
  id: string;
  repositoryName: string;
  branch: string;
  status: SessionStatus;
  createdAt: string;
  lastAccessedAt: string;
  expiresAt: string;
  connectionCount: number;
}

export interface UseSessionsReturn {
  sessions: Session[];
  loading: boolean;
  error: string | null;
  refreshSessions: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<boolean>;
  startSession: (sessionId: string) => Promise<boolean>;
  stopSession: (sessionId: string) => Promise<boolean>;
  getSessionStatus: (sessionId: string) => Promise<SessionStatus | null>;
  createSession: (data: {
    repositoryUrl: string;
    branch: string;
    initialPrompt: string;
    sessionName?: string;
  }) => Promise<Session | null>;
}

export const useSessions = (): UseSessionsReturn => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get('/sessions');
      
      if (response.success && response.data) {
        setSessions(response.data);
      } else {
        setError(response.message || 'Failed to fetch sessions');
      }
    } catch (err: any) {
      console.error('Error fetching sessions:', err);
      setError(err.message || 'Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteSession = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      setError(null);
      
      const response = await api.delete(`/sessions/${sessionId}`);
      
      if (response.success) {
        setSessions(prev => prev.filter(session => session.id !== sessionId));
        return true;
      } else {
        setError(response.message || 'Failed to delete session');
        return false;
      }
    } catch (err: any) {
      console.error('Error deleting session:', err);
      setError(err.message || 'Failed to delete session');
      return false;
    }
  }, []);

  const startSession = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      setError(null);
      
      const response = await api.post(`/sessions/${sessionId}/start`);
      
      if (response.success) {
        // Update the session status in our local state
        setSessions(prev => prev.map(session => 
          session.id === sessionId 
            ? { ...session, status: SessionStatus.RUNNING, lastAccessedAt: new Date().toISOString() }
            : session
        ));
        return true;
      } else {
        setError(response.message || 'Failed to start session');
        return false;
      }
    } catch (err: any) {
      console.error('Error starting session:', err);
      setError(err.message || 'Failed to start session');
      return false;
    }
  }, []);

  const stopSession = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      setError(null);
      
      const response = await api.post(`/sessions/${sessionId}/stop`);
      
      if (response.success) {
        // Update the session status in our local state
        setSessions(prev => prev.map(session => 
          session.id === sessionId 
            ? { ...session, status: SessionStatus.STOPPED }
            : session
        ));
        return true;
      } else {
        setError(response.message || 'Failed to stop session');
        return false;
      }
    } catch (err: any) {
      console.error('Error stopping session:', err);
      setError(err.message || 'Failed to stop session');
      return false;
    }
  }, []);

  const getSessionStatus = useCallback(async (sessionId: string): Promise<SessionStatus | null> => {
    try {
      const response = await api.get(`/sessions/${sessionId}/status`);
      
      if (response.success && response.data) {
        // Update the session status in our local state
        setSessions(prev => prev.map(session => 
          session.id === sessionId 
            ? { ...session, status: response.data.status }
            : session
        ));
        return response.data.status;
      }
      return null;
    } catch (err: any) {
      console.error('Error getting session status:', err);
      return null;
    }
  }, []);

  const createSession = useCallback(async (data: {
    repositoryUrl: string;
    branch: string;
    initialPrompt: string;
    sessionName?: string;
  }): Promise<Session | null> => {
    try {
      setError(null);
      
      const response = await api.post('/sessions', data);
      
      if (response.success && response.data) {
        const newSession = response.data;
        setSessions(prev => [newSession, ...prev]);
        return newSession;
      } else {
        setError(response.message || 'Failed to create session');
        return null;
      }
    } catch (err: any) {
      console.error('Error creating session:', err);
      setError(err.message || 'Failed to create session');
      return null;
    }
  }, []);

  // Auto-refresh sessions every 30 seconds when component is active
  useEffect(() => {
    refreshSessions();
    
    const interval = setInterval(refreshSessions, 30000);
    return () => clearInterval(interval);
  }, [refreshSessions]);

  return {
    sessions,
    loading,
    error,
    refreshSessions,
    deleteSession,
    startSession,
    stopSession,
    getSessionStatus,
    createSession,
  };
};

export default useSessions;
