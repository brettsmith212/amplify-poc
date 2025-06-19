import { useState, useCallback } from 'react';

export interface UseMessageSendingOptions {
  /**
   * Session ID for the thread
   */
  sessionId?: string;
  
  /**
   * Custom validation function for messages
   */
  validateMessage?: (message: string) => string | null;
  
  /**
   * Callback when a message is successfully sent
   */
  onSuccess?: (message: string) => void;
  
  /**
   * Callback when message sending fails
   */
  onError?: (error: Error, message: string) => void;
  
  /**
   * Whether to clear the input after successful send
   */
  clearOnSend?: boolean;
}

export interface UseMessageSendingReturn {
  /**
   * Whether a message is currently being sent
   */
  isSending: boolean;
  
  /**
   * Error message if sending failed
   */
  error: string | null;
  
  /**
   * Function to send a message
   */
  sendMessage: (message: string) => Promise<void>;
  
  /**
   * Function to clear any error state
   */
  clearError: () => void;
  
  /**
   * Last message that was sent
   */
  lastSentMessage: string | null;
}

/**
 * Custom hook for managing message sending logic
 */
export const useMessageSending = (options: UseMessageSendingOptions = {}): UseMessageSendingReturn => {
  const {
    validateMessage,
    onSuccess,
    onError
  } = options;

  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSentMessage, setLastSentMessage] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const sendMessage = useCallback(async (message: string) => {
    // Clear any previous errors
    setError(null);
    
    // Validate message
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      setError('Message cannot be empty');
      return;
    }

    // Custom validation
    if (validateMessage) {
      const validationError = validateMessage(trimmedMessage);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setIsSending(true);

    try {
      // TODO: Replace this with actual WebSocket or API call
      // For now, this is a placeholder that simulates message sending
      await new Promise((resolve, reject) => {
        setTimeout(() => {
          // Simulate random success/failure for testing
          if (Math.random() > 0.1) { // 90% success rate
            resolve(undefined);
          } else {
            reject(new Error('Network error: Failed to send message'));
          }
        }, 500 + Math.random() * 1000); // Random delay between 500-1500ms
      });

      setLastSentMessage(trimmedMessage);
      
      // Call success callback
      if (onSuccess) {
        onSuccess(trimmedMessage);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      
      // Call error callback
      if (onError) {
        onError(err instanceof Error ? err : new Error(errorMessage), trimmedMessage);
      }
    } finally {
      setIsSending(false);
    }
  }, [validateMessage, onSuccess, onError]);

  return {
    isSending,
    error,
    sendMessage,
    clearError,
    lastSentMessage
  };
};

export default useMessageSending;
