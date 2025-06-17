import React from 'react';
import { FileChange } from '../hooks/useDiff';

interface FileTreeProps {
  changes: FileChange[];
  selectedFile: FileChange | null;
  onFileSelect: (file: FileChange) => void;
}

const getFileIcon = (type: FileChange['type']) => {
  switch (type) {
    case 'added':
      return (
        <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
      );
    case 'modified':
      return (
        <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
        </svg>
      );
    case 'deleted':
      return (
        <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      );
  }
};

const getFileExtension = (path: string): string => {
  const parts = path.split('.');
  return parts.length > 1 ? (parts[parts.length - 1] || '') : '';
};

const getFileTypeColor = (path: string): string => {
  const ext = getFileExtension(path).toLowerCase();
  
  // Common file type colors
  const colors: Record<string, string> = {
    // JavaScript/TypeScript
    'js': 'text-yellow-400',
    'jsx': 'text-blue-400',
    'ts': 'text-blue-500',
    'tsx': 'text-blue-600',
    
    // Styles
    'css': 'text-blue-300',
    'scss': 'text-pink-400',
    'sass': 'text-pink-400',
    
    // Markup
    'html': 'text-orange-400',
    'xml': 'text-green-400',
    'json': 'text-yellow-300',
    'yaml': 'text-purple-400',
    'yml': 'text-purple-400',
    
    // Other
    'md': 'text-gray-300',
    'txt': 'text-gray-400',
  };
  
  return colors[ext] || 'text-gray-400';
};

export const FileTree: React.FC<FileTreeProps> = ({
  changes,
  selectedFile,
  onFileSelect
}) => {
  if (changes.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm">No file changes to display</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Changed Files
          </h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {changes.length} file{changes.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      
      <div className="p-2">
        {changes.map((file) => (
          <button
            key={file.path}
            onClick={() => onFileSelect(file)}
            className={`
              w-full text-left px-3 py-2 rounded-lg transition-colors duration-150 ease-in-out
              hover:bg-gray-100 dark:hover:bg-gray-700
              ${selectedFile?.path === file.path 
                ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' 
                : 'border border-transparent'
              }
            `}
          >
            <div className="flex items-center space-x-2">
              {getFileIcon(file.type)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-1">
                  <span className={`text-sm font-medium truncate ${getFileTypeColor(file.path)}`}>
                    {file.path.split('/').pop()}
                  </span>
                  {file.path.includes('/') && (
                    <span className="text-xs text-gray-400 truncate">
                      {file.path.substring(0, file.path.lastIndexOf('/'))}
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-3 mt-1">
                  {file.additions > 0 && (
                    <span className="text-xs text-green-600 dark:text-green-400">
                      +{file.additions}
                    </span>
                  )}
                  {file.deletions > 0 && (
                    <span className="text-xs text-red-600 dark:text-red-400">
                      -{file.deletions}
                    </span>
                  )}
                  <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                    {file.type}
                  </span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default FileTree;
