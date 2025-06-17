import { useState, useCallback } from 'react';
import { api } from '../utils/api';

export interface GitCommitData {
  message: string;
  description?: string;
  files?: string[]; // Specific files to commit, if empty commits all changes
}

export interface GitPushOptions {
  force?: boolean;
  createPullRequest?: boolean;
  pullRequestTitle?: string;
  pullRequestDescription?: string;
}

export interface GitOperationResult {
  success: boolean;
  message?: string;
  error?: string;
  commitHash?: string;
  pullRequestUrl?: string;
}

export interface UseGitReturn {
  committing: boolean;
  pushing: boolean;
  error: string | null;
  lastCommitHash: string | null;
  commit: (sessionId: string, data: GitCommitData) => Promise<GitOperationResult>;
  push: (sessionId: string, options?: GitPushOptions) => Promise<GitOperationResult>;
  clearError: () => void;
}

export const useGit = (): UseGitReturn => {
  const [committing, setCommitting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCommitHash, setLastCommitHash] = useState<string | null>(null);

  const commit = useCallback(async (
    sessionId: string, 
    data: GitCommitData
  ): Promise<GitOperationResult> => {
    setCommitting(true);
    setError(null);

    try {
      const response = await api.post(`/sessions/${sessionId}/git/commit`, data);
      
      if (response.success) {
        setLastCommitHash(response.data?.commitHash || null);
        return {
          success: true,
          message: response.message || 'Changes committed successfully',
          commitHash: response.data?.commitHash
        };
      } else {
        const errorMessage = response.message || 'Failed to commit changes';
        setError(errorMessage);
        return {
          success: false,
          error: errorMessage
        };
      }
    } catch (err: any) {
      console.error('Error committing changes:', err);
      const errorMessage = err.message || 'An unexpected error occurred during commit';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setCommitting(false);
    }
  }, []);

  const push = useCallback(async (
    sessionId: string, 
    options: GitPushOptions = {}
  ): Promise<GitOperationResult> => {
    setPushing(true);
    setError(null);

    try {
      const response = await api.post(`/sessions/${sessionId}/git/push`, options);
      
      if (response.success) {
        return {
          success: true,
          message: response.message || 'Changes pushed successfully',
          pullRequestUrl: response.data?.pullRequestUrl
        };
      } else {
        const errorMessage = response.message || 'Failed to push changes';
        setError(errorMessage);
        return {
          success: false,
          error: errorMessage
        };
      }
    } catch (err: any) {
      console.error('Error pushing changes:', err);
      const errorMessage = err.message || 'An unexpected error occurred during push';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setPushing(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    committing,
    pushing,
    error,
    lastCommitHash,
    commit,
    push,
    clearError
  };
};

export default useGit;
