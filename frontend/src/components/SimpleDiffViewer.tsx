import React from 'react';

interface SimpleDiffViewerProps {
  diffText: string;
  className?: string;
}

export const SimpleDiffViewer: React.FC<SimpleDiffViewerProps> = ({
  diffText,
  className = ''
}) => {
  if (!diffText.trim()) {
    return (
      <div className={`p-8 text-center text-gray-500 ${className}`}>
        <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-lg font-medium">No changes detected</p>
        <p className="text-sm">Make some changes in the terminal to see them here</p>
      </div>
    );
  }

  const lines = diffText.split('\n');

  return (
    <div className={`bg-gray-900 text-gray-100 overflow-auto ${className}`}>
      <pre className="p-4 text-sm font-mono leading-relaxed">
        {lines.map((line, index) => {
          let lineClass = 'block px-2 py-0.5';
          
          if (line.startsWith('+++') || line.startsWith('---')) {
            lineClass += ' text-gray-400 bg-gray-800';
          } else if (line.startsWith('+')) {
            lineClass += ' text-green-300 bg-green-900/30';
          } else if (line.startsWith('-')) {
            lineClass += ' text-red-300 bg-red-900/30';
          } else if (line.startsWith('@@')) {
            lineClass += ' text-blue-300 bg-blue-900/30';
          } else if (line.startsWith('diff --git')) {
            lineClass += ' text-yellow-300 bg-yellow-900/20 font-semibold';
          } else if (line.startsWith('index ')) {
            lineClass += ' text-gray-500';
          } else {
            lineClass += ' text-gray-200';
          }

          return (
            <span key={index} className={lineClass}>
              {line || ' '}
            </span>
          );
        })}
      </pre>
    </div>
  );
};

export default SimpleDiffViewer;
