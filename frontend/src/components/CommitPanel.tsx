import React, { useState, useCallback } from 'react';
import { GitCommitData } from '../hooks/useGit';

interface CommitPanelProps {
  onCommit: (data: GitCommitData) => Promise<void>;
  committing: boolean;
  disabled?: boolean;
  hasChanges?: boolean;
  className?: string;
}

export const CommitPanel: React.FC<CommitPanelProps> = ({
  onCommit,
  committing,
  disabled = false,
  hasChanges = true,
  className = ''
}) => {
  const [message, setMessage] = useState('');
  const [description, setDescription] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) {
      return;
    }

    const commitData: GitCommitData = {
      message: message.trim(),
      ...(description.trim() && { description: description.trim() })
    };

    await onCommit(commitData);
    
    // Clear form after successful commit
    setMessage('');
    setDescription('');
    setIsExpanded(false);
  }, [message, description, onCommit]);

  const toggleExpanded = useCallback(() => {
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg ${className}`}>
      <form onSubmit={handleSubmit}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Commit Changes
            </h3>
            <button
              type="button"
              onClick={toggleExpanded}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
            >
              {isExpanded ? 'Collapse' : 'Add description'}
            </button>
          </div>

          {/* Commit Message */}
          <div className="mb-4">
            <label htmlFor="commit-message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Commit message *
            </label>
            <input
              id="commit-message"
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Summarize your changes..."
              disabled={disabled || committing}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              required
            />
          </div>

          {/* Extended Description */}
          {isExpanded && (
            <div className="mb-4">
              <label htmlFor="commit-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description (optional)
              </label>
              <textarea
                id="commit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide additional details about your changes..."
                disabled={disabled || committing}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-none"
              />
            </div>
          )}

          {/* Status Messages */}
          {!hasChanges ? (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-start space-x-2">
                <svg className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div className="text-sm text-green-800 dark:text-green-200">
                  <p className="font-medium">All changes committed</p>
                  <p className="text-xs mt-1">No changes to commit. Your latest commit is ready to push.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start space-x-2">
                <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-medium mb-1">Commit Message Best Practices</p>
                  <ul className="text-xs space-y-0.5 text-blue-700 dark:text-blue-300">
                    <li>• Use present tense ("Add feature" not "Added feature")</li>
                    <li>• Keep the first line under 50 characters</li>
                    <li>• Be descriptive but concise</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {hasChanges ? 'All changes will be committed' : 'No changes to commit'}
            </div>
            <button
              type="submit"
              disabled={disabled || committing || !message.trim()}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {committing ? (
                <>
                  <div className="w-4 h-4 mr-2 animate-spin border-2 border-white border-t-transparent rounded-full" />
                  Committing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Commit Changes
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CommitPanel;
