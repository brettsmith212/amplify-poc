import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGit } from '../hooks/useGit';
import { SimpleDiffViewer } from '../components/SimpleDiffViewer';
import { CommitPanel } from '../components/CommitPanel';
import { GitActions } from '../components/GitActions';
import { api } from '../utils/api';

export const DiffPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [showGitOperations, setShowGitOperations] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [diffData, setDiffData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    committing,
    pushing,
    error: gitError,
    lastCommitHash,
    commit,
    push,
    clearError: clearGitError
  } = useGit();

  // Simple diff fetching
  const fetchDiff = useCallback(async () => {
    if (!sessionId) return;
    
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/sessions/${sessionId}/diff`);
      
      if (response.success) {
        setDiffData(response.data);
      } else {
        setError(response.error || 'Failed to load diff');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load diff');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchDiff();
  }, [fetchDiff]);

  // Handle git operations
  const handleCommit = useCallback(async (commitData: any) => {
    if (!sessionId) return;
    
    clearGitError();
    setSuccessMessage(null);
    
    const result = await commit(sessionId, commitData);
    if (result.success) {
      setSuccessMessage(`Changes committed successfully${result.commitHash ? ` (${result.commitHash.substring(0, 8)})` : ''}`);
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
    }
  }, [sessionId, push, clearGitError]);

  const handleRefresh = useCallback(() => {
    setSuccessMessage(null);
    clearGitError();
    fetchDiff();
  }, [fetchDiff, clearGitError]);

  if (!sessionId) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Invalid Session</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">No session ID provided</p>
          <button
            onClick={() => navigate('/sessions')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Sessions
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/sessions')}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Diff Viewer</h1>
            <p className="text-gray-600 dark:text-gray-400">Session: {sessionId}</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
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
            {showGitOperations ? 'Hide' : 'Git Actions'}
          </button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {(successMessage || gitError) && (
        <div className="mb-4">
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
      {showGitOperations && diffData?.hasChanges && (
        <div className="mb-6 p-6 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="grid md:grid-cols-2 gap-6">
            <CommitPanel
              onCommit={handleCommit}
              committing={committing}
              disabled={committing || pushing}
            />
            
            <GitActions
              onPush={handlePush}
              pushing={pushing}
              hasCommits={!!lastCommitHash}
              disabled={committing || pushing}
            />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-lg">
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Git Diff</h3>
            {diffData && diffData.hasChanges && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {diffData.repositoryName} • {diffData.branch}
              </p>
            )}
          </div>
          
          <div className="flex-1 overflow-hidden">
            {loading && (
              <div className="flex items-center justify-center h-full">
                <div className="flex items-center space-x-3 text-gray-600 dark:text-gray-400">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span>Loading changes...</span>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center p-6">
                  <div className="w-16 h-16 mx-auto mb-4 text-red-500">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Error Loading Changes</h3>
                  <p className="text-gray-600 dark:text-gray-400">{error}</p>
                  <button
                    onClick={fetchDiff}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}

            {diffData && !loading && !error && (
              <SimpleDiffViewer 
                diffText={diffData.rawDiff || ''} 
                className="h-full"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};



export default DiffPage;
