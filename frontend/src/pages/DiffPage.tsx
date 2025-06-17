import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDiff } from '../hooks/useDiff';
import { useGit } from '../hooks/useGit';
import { DiffViewer } from '../components/DiffViewer';
import { FileTree } from '../components/FileTree';
import { CommitPanel } from '../components/CommitPanel';
import { GitActions } from '../components/GitActions';

export const DiffPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [showGitOperations, setShowGitOperations] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const {
    diffData,
    selectedFile,
    loading,
    error,
    refreshDiff,
    selectFile
  } = useDiff(sessionId || '');

  const {
    committing,
    pushing,
    error: gitError,
    lastCommitHash,
    commit,
    push,
    clearError: clearGitError
  } = useGit();

  // Handle git operations
  const handleCommit = useCallback(async (commitData: any) => {
    if (!sessionId) return;
    
    clearGitError();
    setSuccessMessage(null);
    
    const result = await commit(sessionId, commitData);
    if (result.success) {
      setSuccessMessage(`Changes committed successfully${result.commitHash ? ` (${result.commitHash.substring(0, 8)})` : ''}`);
      // Refresh diff data after commit
      await refreshDiff();
    }
  }, [sessionId, commit, clearGitError, refreshDiff]);

  const handlePush = useCallback(async (pushOptions?: any) => {
    if (!sessionId) return;
    
    clearGitError();
    setSuccessMessage(null);
    
    const result = await push(sessionId, pushOptions);
    if (result.success) {
      setSuccessMessage('Changes pushed successfully');
      if (result.pullRequestUrl) {
        setSuccessMessage(`Changes pushed successfully. Pull request created: ${result.pullRequestUrl}`);
      }
    }
  }, [sessionId, push, clearGitError]);

  const hasChanges = diffData?.changes && diffData.changes.length > 0;
  const hasCommits = !!lastCommitHash; // This is a simple check, could be enhanced

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Invalid Session
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            No session ID provided
          </p>
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-2 animate-pulse"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse"></div>
                </div>
                <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse"></div>
              </div>
            </div>
            <div className="h-96 bg-gray-100 dark:bg-gray-800 animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <svg className="w-16 h-16 mx-auto mb-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Error Loading Diff
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error}
          </p>
          <div className="space-x-4">
            <button
              onClick={refreshDiff}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate('/sessions')}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Back to Sessions
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  File Changes
                </h1>
                {diffData && (
                  <div className="flex items-center space-x-4 mt-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {diffData.repositoryName} • {diffData.branch}
                    </span>
                    {diffData.totalAdditions > 0 && (
                      <span className="text-sm text-green-600 dark:text-green-400">
                        +{diffData.totalAdditions} additions
                      </span>
                    )}
                    {diffData.totalDeletions > 0 && (
                      <span className="text-sm text-red-600 dark:text-red-400">
                        -{diffData.totalDeletions} deletions
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={refreshDiff}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  Refresh
                </button>
                {hasChanges && (
                  <button
                    onClick={() => setShowGitOperations(!showGitOperations)}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    {showGitOperations ? 'Hide Git Operations' : 'Commit & Push'}
                  </button>
                )}
                <button
                  onClick={() => navigate(`/terminal/${sessionId}`)}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Open Terminal
                </button>
                <button
                  onClick={() => navigate('/sessions')}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  Back to Sessions
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Success/Error Messages */}
        {(successMessage || gitError) && (
          <div className="mb-6">
            {successMessage && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium text-green-800 dark:text-green-200">{successMessage}</span>
                  <button
                    onClick={() => setSuccessMessage(null)}
                    className="ml-auto text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
            {gitError && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium text-red-800 dark:text-red-200">{gitError}</span>
                  <button
                    onClick={clearGitError}
                    className="ml-auto text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Git Operations Panel */}
        {showGitOperations && (
          <div className="mb-6 space-y-4">
            <CommitPanel
              onCommit={handleCommit}
              committing={committing}
              disabled={!hasChanges}
            />
            <GitActions
              onPush={handlePush}
              pushing={pushing}
              hasCommits={hasCommits}
              disabled={!hasChanges}
            />
          </div>
        )}

        {/* Main Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex h-[calc(100vh-280px)]">
            {/* File Tree Sidebar */}
            <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <FileTree
                changes={diffData?.changes || []}
                selectedFile={selectedFile}
                onFileSelect={selectFile}
              />
            </div>

            {/* Diff Viewer */}
            <div className="flex-1">
              <DiffViewer file={selectedFile} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiffPage;
