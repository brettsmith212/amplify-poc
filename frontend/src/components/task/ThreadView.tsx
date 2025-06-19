import React from 'react';
import { ThreadMessage } from '../../types/threadMessage';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import useAutoScroll from '../../hooks/useAutoScroll';
import useThreadMessages from '../../hooks/useThreadMessages';
import { ConnectionState } from '../../services/threadWebSocket';

export interface ThreadViewProps {
  /**
   * Session ID for the thread
   */
  sessionId: string;
  
  /**
   * Custom className for the container
   */
  className?: string;
  
  /**
   * Whether to automatically load message history
   */
  loadHistory?: boolean;
  
  /**
   * API base URL for HTTP requests
   */
  apiBaseUrl?: string;
  
  /**
   * Callback when connection state changes
   */
  onConnectionChange?: (state: ConnectionState) => void;
  
  /**
   * Callback when an error occurs
   */
  onError?: (error: Error) => void;
}

// Loading spinner component
const LoadingSpinner: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex items-center justify-center p-4 ${className}`}>
    <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
      <span className="text-sm">Loading messages...</span>
    </div>
  </div>
);

// Connection status component
const ConnectionStatus: React.FC<{ 
  connectionState: ConnectionState; 
  onRetry?: () => void;
}> = ({ connectionState, onRetry }) => {
  if (connectionState === ConnectionState.CONNECTED) return null;

  const getStatusConfig = () => {
    switch (connectionState) {
      case ConnectionState.CONNECTING:
        return {
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          borderColor: 'border-blue-200 dark:border-blue-800',
          textColor: 'text-blue-600 dark:text-blue-400',
          iconColor: 'bg-blue-500',
          message: 'Connecting to session...',
          showRetry: false
        };
      case ConnectionState.RECONNECTING:
        return {
          bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
          borderColor: 'border-yellow-200 dark:border-yellow-800',
          textColor: 'text-yellow-600 dark:text-yellow-400',
          iconColor: 'bg-yellow-500',
          message: 'Reconnecting...',
          showRetry: false
        };
      case ConnectionState.ERROR:
        return {
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          borderColor: 'border-red-200 dark:border-red-800',
          textColor: 'text-red-600 dark:text-red-400',
          iconColor: 'bg-red-500',
          message: 'Connection failed',
          showRetry: true
        };
      case ConnectionState.DISCONNECTED:
      default:
        return {
          bgColor: 'bg-gray-50 dark:bg-gray-900/20',
          borderColor: 'border-gray-200 dark:border-gray-800',
          textColor: 'text-gray-600 dark:text-gray-400',
          iconColor: 'bg-gray-500',
          message: 'Disconnected',
          showRetry: true
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={`flex items-center justify-between p-4 ${config.bgColor} border ${config.borderColor} rounded-lg mb-4`}>
      <div className={`flex items-center space-x-2 ${config.textColor}`}>
        <div className={`w-2 h-2 ${config.iconColor} rounded-full ${connectionState === ConnectionState.CONNECTING || connectionState === ConnectionState.RECONNECTING ? 'animate-pulse' : ''}`}></div>
        <span className="text-sm">{config.message}</span>
      </div>
      {config.showRetry && onRetry && (
        <button
          onClick={onRetry}
          className={`px-3 py-1 text-xs rounded-md border ${config.textColor} hover:bg-white/50 dark:hover:bg-black/20 transition-colors`}
        >
          Retry
        </button>
      )}
    </div>
  );
};

// Empty state component
const EmptyState: React.FC = () => (
  <div className="flex-1 flex items-center justify-center p-8">
    <div className="text-center max-w-md">
      <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
        Start a conversation
      </h3>
      <p className="text-gray-500 dark:text-gray-400 text-sm">
        Send a message to begin your session with Amp. Ask questions, request code changes, or get help with your project.
      </p>
    </div>
  </div>
);



// Main ThreadView component
export const ThreadView: React.FC<ThreadViewProps> = ({
  sessionId,
  className = '',
  loadHistory = true,
  apiBaseUrl,
  onConnectionChange,
  onError
}) => {
  const {
    messages,
    isConnected,
    connectionState,
    isLoading,
    isSending,
    error,
    sendMessage,
    clearError,
    reconnect
  } = useThreadMessages({
    sessionId,
    loadHistory,
    apiBaseUrl
  });

  const { scrollRef } = useAutoScroll({
    dependencies: [messages.length],
    enabled: true,
    behavior: 'smooth',
    delay: 50 // Small delay to ensure DOM is updated
  });

  const hasMessages = messages.length > 0;

  // Handle connection state changes
  React.useEffect(() => {
    if (onConnectionChange) {
      onConnectionChange(connectionState);
    }
  }, [connectionState, onConnectionChange]);

  // Handle errors
  React.useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  const handleSendMessage = async (content: string) => {
    const success = await sendMessage(content);
    if (!success && error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleRetry = () => {
    clearError();
    reconnect();
  };

  return (
    <div className={`flex flex-col h-full bg-gray-50 dark:bg-gray-900 ${className}`}>
      {/* Connection Status */}
      <div className="flex-shrink-0 p-4">
        <ConnectionStatus connectionState={connectionState} onRetry={handleRetry} />
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="h-full flex flex-col">
          {isLoading ? (
            <LoadingSpinner className="flex-1" />
          ) : !hasMessages ? (
            <EmptyState />
          ) : (
            <div className="flex-1 p-4 space-y-4">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                />
              ))}
              {/* Scroll anchor */}
              <div ref={scrollRef} className="h-1" />
            </div>
          )}
        </div>
      </div>

      {/* Message Input */}
      <div className="flex-shrink-0">
        <MessageInput
          onSendMessage={handleSendMessage}
          isSending={isSending}
          disabled={!isConnected || isLoading}
        />
      </div>
    </div>
  );
};

export default ThreadView;
