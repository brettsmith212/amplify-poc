import React, { useState, useCallback, useEffect } from 'react';
import { SimpleDiffViewer } from '../SimpleDiffViewer';
import { CommitPanel } from '../CommitPanel';
import { GitActions } from '../GitActions';
import { useGit } from '../../hooks/useGit';
import { api } from '../../utils/api';

export interface GitDiffProps {
  /**
   * Session ID for the diff
   */
  sessionId: string;
  
  /**
   * Custom className for the container
   */
  className?: string;
  
  /**
   * Callback when refresh is triggered
   */
  onRefresh?: () => void;
  
  /**
   * Callback when an error occurs
   */
  onError?: (error: Error) => void;
}

export const GitDiff: React.FC<GitDiffProps> = ({
  sessionId,
  className = '',
  onRefresh,
  onError
}) => {
  const [diffData, setDiffData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showGitOperations, setShowGitOperations] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasUnpushedCommits, setHasUnpushedCommits] = useState(false);

  const {
    committing,
    pushing,
    error: gitError,
    lastCommitHash,
    commit,
    push,
    clearError: clearGitError
  } = useGit();

  // Check for unpushed commits
  const checkUnpushedCommits = useCallback(async () => {
    if (!sessionId) return;
    
    try {
      const response = await api.get(`/sessions/${sessionId}/git/status`);
      if (response.success && response.data) {
        // Check if git status indicates commits ahead of origin
        const status = response.data.status || '';
        const hasUnpushed = status.includes('ahead') || status.includes('Your branch is ahead');
        setHasUnpushedCommits(hasUnpushed);
      }
    } catch (err: any) {
      // Silently fail for git status check
      console.warn('Failed to check git status:', err.message);
    }
  }, [sessionId]);

  // Fetch diff data
  const fetchDiff = useCallback(async () => {
    if (!sessionId) return;
    
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/sessions/${sessionId}/diff`);
      
      if (response.success) {
        setDiffData(response.data);
      } else {
        const errorMsg = response.error || 'Failed to load diff';
        setError(errorMsg);
        if (onError) {
          onError(new Error(errorMsg));
        }
      }
      
      // Also check for unpushed commits
      await checkUnpushedCommits();
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to load diff';
      setError(errorMsg);
      if (onError) {
        onError(err instanceof Error ? err : new Error(errorMsg));
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId, onError, checkUnpushedCommits]);

  useEffect(() => {
    fetchDiff();
  }, [fetchDiff]);

  const handleRefresh = useCallback(() => {
    setError(null);
    setSuccessMessage(null);
    clearGitError();
    fetchDiff();
    if (onRefresh) {
      onRefresh();
    }
  }, [fetchDiff, onRefresh, clearGitError]);

  // Handle git operations
  const handleCommit = useCallback(async (commitData: any) => {
    if (!sessionId) return;
    
    clearGitError();
    setSuccessMessage(null);
    
    const result = await commit(sessionId, commitData);
    if (result.success) {
      // Validate commit hash - should be a 40-character hex string
      let hashDisplay = '';
      if (result.commitHash && typeof result.commitHash === 'string' && /^[a-f0-9]{40}$/i.test(result.commitHash)) {
        hashDisplay = ` (${result.commitHash.substring(0, 8)})`;
      }
      setSuccessMessage(`Changes committed successfully${hashDisplay}`);
      
      // Mark that we have unpushed commits
      setHasUnpushedCommits(true);
      
      // Refresh diff data after commit
      await fetchDiff();
    }
  }, [sessionId, commit, clearGitError, fetchDiff]);

  const handlePush = useCallback(async (pushOptions?: any) => {
    if (!sessionId) return;
    
    clearGitError();
    setSuccessMessage(null);
    
    const result = await push(sessionId, pushOptions);
    if (result.success) {
      setSuccessMessage(`Changes pushed successfully${result.pullRequestUrl ? ` - ${result.pullRequestUrl}` : ''}`);
      // After successful push, we no longer have unpushed commits
      setHasUnpushedCommits(false);
    }
  }, [sessionId, push, clearGitError]);

  if (loading) {
    return (
      <div className={`h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900 ${className}`}>
        <div className="flex items-center space-x-3 text-gray-600 dark:text-gray-400">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span>Loading changes...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900 ${className}`}>
        <div className="text-center p-6">
          <div className="w-16 h-16 mx-auto mb-4 text-red-500">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Error Loading Changes</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col bg-gray-50 dark:bg-gray-900 ${className}`}>
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Git Diff</h3>
            {diffData && diffData.hasChanges && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {diffData.repositoryName} • {diffData.branch}
              </p>
            )}
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>

            <button
              onClick={() => setShowGitOperations(!showGitOperations)}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-green-600 to-blue-600 rounded-lg hover:from-green-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-green-500/20 transition-all duration-200"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              {showGitOperations ? 'Hide Git Actions' : 'Git Actions'}
            </button>
          </div>
        </div>
      </div>

      {/* Success/Error Messages */}
      {(successMessage || gitError) && (
        <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
          {successMessage && (
            <div className="flex items-center p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-green-800 dark:text-green-200">{successMessage}</span>
            </div>
          )}
          
          {gitError && (
            <div className="flex items-center p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-800 dark:text-red-200">{gitError}</span>
            </div>
          )}
        </div>
      )}

      {/* Git Operations Panel */}
      {showGitOperations && (
        <div className="flex-shrink-0 p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="grid md:grid-cols-2 gap-4">
            <CommitPanel
              onCommit={handleCommit}
              committing={committing}
              disabled={committing || pushing || !diffData?.hasChanges}
              hasChanges={diffData?.hasChanges || false}
            />
            
            <GitActions
              onPush={handlePush}
              pushing={pushing}
              hasCommits={!!lastCommitHash || hasUnpushedCommits}
              disabled={committing || pushing}
            />
          </div>
        </div>
      )}
      
      {/* Diff Viewer */}
      <div className="flex-1 overflow-hidden">
        <SimpleDiffViewer 
          diffText={diffData?.rawDiff || ''} 
          className="h-full"
        />
      </div>
    </div>
  );
};

export default GitDiff;
