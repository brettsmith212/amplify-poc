import React, { useEffect, useRef } from 'react';
import { Editor, DiffEditor } from '@monaco-editor/react';
import { FileChange } from '../hooks/useDiff';

interface DiffViewerProps {
  file: FileChange | null;
  className?: string;
}

const getLanguageFromPath = (path: string): string => {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  
  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'html': 'html',
    'xml': 'xml',
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'md': 'markdown',
    'py': 'python',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'cs': 'csharp',
    'php': 'php',
    'rb': 'ruby',
    'go': 'go',
    'rs': 'rust',
    'sh': 'shell',
    'bash': 'shell',
    'sql': 'sql',
    'dockerfile': 'dockerfile',
  };
  
  return languageMap[ext] || 'plaintext';
};

export const DiffViewer: React.FC<DiffViewerProps> = ({ 
  file, 
  className = '' 
}) => {
  const editorRef = useRef<any>(null);

  useEffect(() => {
    // Configure Monaco editor theme for dark mode support
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      // Dark theme will be handled by Monaco's built-in themes
    }
  }, []);

  if (!file) {
    return (
      <div className={`flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900 ${className}`}>
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
            Select a file to view changes
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Choose a file from the file tree to see the diff
          </p>
        </div>
      </div>
    );
  }

  const language = getLanguageFromPath(file.path);

  // For new files, show only the new content
  if (file.type === 'added' && file.modifiedContent) {
    return (
      <div className={`h-full ${className}`}>
        <div className="h-full border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="bg-green-50 dark:bg-green-900/20 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-green-800 dark:text-green-200">
                New file: {file.path}
              </span>
              <span className="text-xs text-green-600 dark:text-green-400">
                +{file.additions} lines
              </span>
            </div>
          </div>
          <Editor
            height="calc(100% - 49px)"
            language={language}
            value={file.modifiedContent}
            theme="vs-dark"
            options={{
              readOnly: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              lineNumbers: 'on',
              renderWhitespace: 'selection',
              wordWrap: 'on',
            }}
            onMount={(editor) => {
              editorRef.current = editor;
            }}
          />
        </div>
      </div>
    );
  }

  // For deleted files, show only the original content
  if (file.type === 'deleted' && file.originalContent) {
    return (
      <div className={`h-full ${className}`}>
        <div className="h-full border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="bg-red-50 dark:bg-red-900/20 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-red-800 dark:text-red-200">
                Deleted file: {file.path}
              </span>
              <span className="text-xs text-red-600 dark:text-red-400">
                -{file.deletions} lines
              </span>
            </div>
          </div>
          <Editor
            height="calc(100% - 49px)"
            language={language}
            value={file.originalContent}
            theme="vs-dark"
            options={{
              readOnly: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              lineNumbers: 'on',
              renderWhitespace: 'selection',
              wordWrap: 'on',
            }}
            onMount={(editor) => {
              editorRef.current = editor;
            }}
          />
        </div>
      </div>
    );
  }

  // For modified files, show diff view
  if (file.type === 'modified' && file.originalContent && file.modifiedContent) {
    return (
      <div className={`h-full ${className}`}>
        <div className="h-full border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
              <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Modified: {file.path}
              </span>
              <div className="flex items-center space-x-3">
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
              </div>
            </div>
          </div>
          <DiffEditor
            height="calc(100% - 49px)"
            language={language}
            original={file.originalContent}
            modified={file.modifiedContent}
            theme="vs-dark"
            options={{
              readOnly: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              lineNumbers: 'on',
              renderWhitespace: 'selection',
              wordWrap: 'off', // Diff view works better without word wrap
              enableSplitViewResizing: true,
              renderSideBySide: true,
            }}
            onMount={(editor) => {
              editorRef.current = editor;
            }}
          />
        </div>
      </div>
    );
  }

  // Fallback for any other cases
  return (
    <div className={`flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900 ${className}`}>
      <div className="text-center">
        <svg className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
          Unable to display file content
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          The file content could not be loaded
        </p>
      </div>
    </div>
  );
};

export default DiffViewer;
