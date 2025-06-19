import React, { useState, useRef, useEffect } from 'react';

export interface MessageInputProps {
  /**
   * Callback when user sends a message
   */
  onSendMessage?: ((message: string) => void) | undefined;
  
  /**
   * Whether the send functionality is currently processing
   */
  isSending?: boolean;
  
  /**
   * Whether the input is disabled
   */
  disabled?: boolean;
  
  /**
   * Placeholder text for the textarea
   */
  placeholder?: string;
  
  /**
   * Custom className for the container
   */
  className?: string;
  
  /**
   * Whether to show the keyboard shortcut hint
   */
  showHint?: boolean;
  
  /**
   * Auto-focus on mount
   */
  autoFocus?: boolean;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  isSending = false,
  disabled = false,
  placeholder = "Type a message to continue the task... (⌘/Ctrl + Enter to send)",
  className = '',
  showHint = true,
  autoFocus = true
}) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    if (textareaRef.current && !disabled && autoFocus) {
      textareaRef.current.focus();
    }
  }, [disabled, autoFocus]);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const handleSend = () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage && onSendMessage && !isSending && !disabled) {
      onSendMessage(trimmedMessage);
      setMessage('');
      
      // Reset textarea height after clearing
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
  };

  const isValid = message.trim().length > 0;
  const canSend = isValid && !isSending && !disabled;

  return (
    <div className={`border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900 ${className}`}>
      <div className="flex space-x-3">
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
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
            aria-label="Message input"
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!canSend}
          className={`
            inline-flex items-center justify-center w-10 h-10 rounded-lg
            transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
            ${
              canSend
                ? 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
            }
          `}
          title={isSending ? 'Sending...' : 'Send message (⌘/Ctrl + Enter)'}
          aria-label={isSending ? 'Sending message' : 'Send message'}
        >
          {isSending ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>
      {showHint && !disabled && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Press ⌘/Ctrl + Enter to send
        </p>
      )}
    </div>
  );
};

export default MessageInput;
