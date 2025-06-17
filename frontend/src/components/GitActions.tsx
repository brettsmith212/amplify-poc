import React, { useState } from 'react';
import { GitPushOptions } from '../hooks/useGit';

interface GitActionsProps {
  onPush: (options?: GitPushOptions) => Promise<void>;
  pushing: boolean;
  hasCommits: boolean;
  disabled?: boolean;
  className?: string;
}

export const GitActions: React.FC<GitActionsProps> = ({
  onPush,
  pushing,
  hasCommits,
  disabled = false,
  className = ''
}) => {
  const [showPushOptions, setShowPushOptions] = useState(false);
  const [createPR, setCreatePR] = useState(false);
  const [prTitle, setPrTitle] = useState('');
  const [prDescription, setPrDescription] = useState('');
  const [forcePush, setForcePush] = useState(false);

  const handlePush = async () => {
    const options: GitPushOptions = {
      force: forcePush,
      createPullRequest: createPR,
      ...(createPR && prTitle && { pullRequestTitle: prTitle }),
      ...(createPR && prDescription && { pullRequestDescription: prDescription }),
    };

    await onPush(options);
    
    // Reset options after push
    setShowPushOptions(false);
    setCreatePR(false);
    setPrTitle('');
    setPrDescription('');
    setForcePush(false);
  };

  const canPush = hasCommits && !disabled && !pushing;

  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg ${className}`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Push Changes
          </h3>
          {canPush && (
            <button
              onClick={() => setShowPushOptions(!showPushOptions)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
            >
              {showPushOptions ? 'Hide options' : 'Show options'}
            </button>
          )}
        </div>

        {!hasCommits && (
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-start space-x-2">
              <svg className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="text-sm text-yellow-800 dark:text-yellow-200">
                <p className="font-medium">No commits to push</p>
                <p className="text-xs mt-1">Commit your changes first before pushing to the repository.</p>
              </div>
            </div>
          </div>
        )}

        {/* Push Options */}
        {showPushOptions && canPush && (
          <div className="mb-4 space-y-4 p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg">
            {/* Create Pull Request */}
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={createPR}
                  onChange={(e) => setCreatePR(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-700"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Create Pull Request
                </span>
              </label>
              
              {createPR && (
                <div className="mt-3 space-y-3">
                  <div>
                    <label htmlFor="pr-title" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Pull Request Title
                    </label>
                    <input
                      id="pr-title"
                      type="text"
                      value={prTitle}
                      onChange={(e) => setPrTitle(e.target.value)}
                      placeholder="Enter pull request title..."
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label htmlFor="pr-description" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description (optional)
                    </label>
                    <textarea
                      id="pr-description"
                      value={prDescription}
                      onChange={(e) => setPrDescription(e.target.value)}
                      placeholder="Describe your changes..."
                      rows={2}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Force Push */}
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={forcePush}
                  onChange={(e) => setForcePush(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 text-red-600 focus:ring-red-500 dark:bg-gray-700"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Force push
                </span>
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                ⚠️ Use with caution - this will overwrite remote history
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {hasCommits ? 'Ready to push to remote repository' : 'Commit changes to enable push'}
          </div>
          <button
            onClick={handlePush}
            disabled={!canPush}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {pushing ? (
              <>
                <div className="w-4 h-4 mr-2 animate-spin border-2 border-white border-t-transparent rounded-full" />
                Pushing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                </svg>
                Push Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GitActions;
