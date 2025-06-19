import React from 'react';
import { MessageBubbleProps, MessageRole, RoleConfig } from '../../types/threadMessage';
import { formatTimestamp, getMetadataDisplay, formatFilesList } from '../../utils/messageFormatting';

// Icon components for different roles
const UserIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
  </svg>
);

const BotIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
  </svg>
);

const SystemIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
  </svg>
);

// Error/Warning icons for metadata
const ErrorIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
);

const FileIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
  </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);

/**
 * Get role configuration for styling and display
 */
const getRoleConfig = (role: MessageRole): RoleConfig => {
  switch (role) {
    case 'user':
      return {
        icon: UserIcon,
        label: 'You',
        bgColor: 'bg-blue-600',
        textColor: 'text-blue-600 dark:text-blue-400',
        bubbleColor: 'bg-blue-50 dark:bg-blue-900/20',
        borderColor: 'border-blue-200 dark:border-blue-800'
      };
    case 'amp':
      return {
        icon: BotIcon,
        label: 'Amp',
        bgColor: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
        textColor: 'text-emerald-600 dark:text-emerald-400',
        bubbleColor: 'bg-emerald-50 dark:bg-emerald-900/20',
        borderColor: 'border-emerald-200 dark:border-emerald-800'
      };
    case 'system':
      return {
        icon: SystemIcon,
        label: 'System',
        bgColor: 'bg-gray-600',
        textColor: 'text-gray-600 dark:text-gray-400',
        bubbleColor: 'bg-gray-50 dark:bg-gray-800/50',
        borderColor: 'border-gray-200 dark:border-gray-700'
      };
    default:
      return getRoleConfig('system');
  }
};

/**
 * Get metadata indicator component
 */
const getMetadataIndicator = (type?: string, exitCode?: number) => {
  if (type === 'error' || (exitCode !== undefined && exitCode !== 0)) {
    return (
      <div className="flex items-center space-x-1 text-red-500 dark:text-red-400">
        <ErrorIcon className="w-3 h-3" />
        <span className="text-xs font-medium">Error</span>
      </div>
    );
  }
  
  if (type === 'file_change') {
    return (
      <div className="flex items-center space-x-1 text-blue-500 dark:text-blue-400">
        <FileIcon className="w-3 h-3" />
        <span className="text-xs font-medium">Files Changed</span>
      </div>
    );
  }
  
  if (type === 'code' && exitCode === 0) {
    return (
      <div className="flex items-center space-x-1 text-green-500 dark:text-green-400">
        <CheckIcon className="w-3 h-3" />
        <span className="text-xs font-medium">Success</span>
      </div>
    );
  }
  
  return null;
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({ 
  message, 
  className = '' 
}) => {
  const { role, content, ts, metadata } = message;
  const roleConfig = getRoleConfig(role);
  const Icon = roleConfig.icon;
  const timestamp = formatTimestamp(ts);
  const metadataText = getMetadataDisplay(metadata);
  const files = formatFilesList(metadata?.files);
  const metadataIndicator = getMetadataIndicator(metadata?.type, metadata?.exitCode);

  return (
    <div className={`flex space-x-3 mb-4 ${className}`}>
      {/* Avatar */}
      <div className="flex-shrink-0">
        <div className={`w-8 h-8 rounded-full ${roleConfig.bgColor} flex items-center justify-center shadow-sm`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
      
      {/* Content Area */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center space-x-2 mb-1">
          <span className={`text-sm font-medium ${roleConfig.textColor}`}>
            {roleConfig.label}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {timestamp}
          </span>
          {metadataIndicator}
        </div>
        
        {/* Message Bubble */}
        <div className={`
          rounded-lg p-3 max-w-4xl
          ${roleConfig.bubbleColor} 
          ${roleConfig.borderColor} 
          border
          shadow-sm
        `}>
          {/* Metadata Text */}
          {metadataText && (
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2 font-medium">
              {metadataText}
            </div>
          )}
          
          {/* Message Content */}
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <div className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
              {content}
            </div>
          </div>
          
          {/* Files List */}
          {files.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-2 font-medium">
                Modified Files:
              </div>
              <div className="space-y-1">
                {files.map((file, index) => (
                  <div 
                    key={index}
                    className="flex items-center space-x-2 text-xs text-gray-700 dark:text-gray-300"
                  >
                    <FileIcon className="w-3 h-3 text-gray-400" />
                    <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-xs">
                      {file}
                    </code>
                  </div>
                ))}
                {metadata?.files && metadata.files.length > 10 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 italic">
                    ... and {metadata.files.length - 10} more files
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
