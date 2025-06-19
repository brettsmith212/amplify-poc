import React, { useState, useRef, useEffect } from 'react';
import { ThreadMessage } from '../../types/threadMessage';
import MessageBubble from './MessageBubble';
import useAutoScroll from '../../hooks/useAutoScroll';

export interface ThreadViewProps {
  /**
   * Session ID for the thread
   */
  sessionId: string;
  
  /**
   * Array of messages to display
   */
  messages: ThreadMessage[];
  
  /**
   * Whether the component is in a loading state
   */
  isLoading?: boolean;
  
  /**
   * Whether the WebSocket connection is active
   */
  isConnected?: boolean;
  
  /**
   * Callback when user sends a message
   */
  onSendMessage?: (message: string) => void;
  
  /**
   * Whether the send functionality is currently processing
   */
  isSending?: boolean;
  
  /**
   * Custom className for the container
   */
  className?: string;
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
const ConnectionStatus: React.FC<{ isConnected: boolean }> = ({ isConnected }) => {
  if (isConnected) return null;

  return (
    <div className="flex items-center justify-center p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg mb-4">
      <div className="flex items-center space-x-2 text-yellow-600 dark:text-yellow-400">
        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
        <span className="text-sm">Connecting to session...</span>
      </div>
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

// Message input component
const MessageInput: React.FC<{
  onSendMessage?: ((message: string) => void) | undefined;
  isSending?: boolean;
  disabled?: boolean;
}> = ({ onSendMessage, isSending = false, disabled = false }) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    if (textareaRef.current && !disabled) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const handleSend = () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage && onSendMessage && !isSending) {
      onSendMessage(trimmedMessage);
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const isValid = message.trim().length > 0;

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900">
      <div className="flex space-x-3">
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message to continue the task... (⌘/Ctrl + Enter to send)"
            disabled={disabled || isSending}
            className={`
              w-full resize-none rounded-lg border border-gray-300 dark:border-gray-600
              bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
              placeholder-gray-500 dark:placeholder-gray-400
              px-3 py-2 text-sm leading-5 min-h-[40px] max-h-32
              focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors duration-200
            `}
            rows={1}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!isValid || isSending || disabled}
          className={`
            inline-flex items-center justify-center w-10 h-10 rounded-lg
            transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
            ${
              isValid && !isSending && !disabled
                ? 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
            }
          `}
          title={isSending ? 'Sending...' : 'Send message (⌘/Ctrl + Enter)'}
          aria-label={isSending ? 'Sending message' : 'Send message'}
        >
          {isSending ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        Press ⌘/Ctrl + Enter to send
      </p>
    </div>
  );
};

// Main ThreadView component
export const ThreadView: React.FC<ThreadViewProps> = ({
  messages,
  isLoading = false,
  isConnected = true,
  onSendMessage,
  isSending = false,
  className = ''
}) => {
  const { scrollRef } = useAutoScroll({
    dependencies: [messages.length],
    enabled: true,
    behavior: 'smooth',
    delay: 50 // Small delay to ensure DOM is updated
  });

  const hasMessages = messages.length > 0;

  return (
    <div className={`flex flex-col h-full bg-gray-50 dark:bg-gray-900 ${className}`}>
      {/* Connection Status */}
      <div className="flex-shrink-0 p-4">
        <ConnectionStatus isConnected={isConnected} />
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
          onSendMessage={onSendMessage}
          isSending={isSending}
          disabled={!isConnected || isLoading}
        />
      </div>
    </div>
  );
};

export default ThreadView;
