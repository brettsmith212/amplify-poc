import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDiff } from '../hooks/useDiff';
import { DiffViewer } from '../components/DiffViewer';
import { FileTree } from '../components/FileTree';

export const DiffPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  const {
    diffData,
    selectedFile,
    loading,
    error,
    refreshDiff,
    selectFile
  } = useDiff(sessionId || '');

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
