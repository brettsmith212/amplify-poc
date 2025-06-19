import React, { useState, useEffect } from 'react';
import { getOrCreateDevSession, DevSessionData, isDevModeAvailable } from '../../services/devSession';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import useAutoScroll from '../../hooks/useAutoScroll';
import useDevThreadHistory from '../../hooks/useDevThreadHistory';

interface DevThreadViewProps {
  onError?: (error: Error) => void;
}

/**
 * Development wrapper for ThreadView that automatically creates a session
 */
export const DevThreadView: React.FC<DevThreadViewProps> = ({ onError }) => {
  const [devSession, setDevSession] = useState<DevSessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isDevMode, setIsDevMode] = useState<boolean>(false);

  useEffect(() => {
    const setupDevSession = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Check if dev mode is available
        const devModeAvailable = await isDevModeAvailable();
        setIsDevMode(devModeAvailable);

        if (!devModeAvailable) {
          throw new Error('Development mode not available - backend not running on localhost:3000');
        }

        // Get or create a development session
        const session = await getOrCreateDevSession();
        setDevSession(session);

        console.log('Development session ready:', session);

      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to setup development session');
        setError(error);
        onError?.(error);
        console.error('Failed to setup development session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    setupDevSession();
  }, [onError]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="mb-4">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
          <p className="text-gray-600">Setting up development session...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <div className="mb-4 text-red-500">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Development Session Error
          </h3>
          <p className="text-gray-600 mb-4">
            {error.message}
          </p>
          {!isDevMode && (
            <div className="text-sm text-gray-500">
              <p>Make sure the backend is running with:</p>
              <code className="bg-gray-100 px-2 py-1 rounded mt-1 block">npm run dev</code>
            </div>
          )}
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!devSession) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-600">No development session available</p>
        </div>
      </div>
    );
  }

  // Render the custom development thread interface
  return (
    <DevThreadInterface 
      sessionId={devSession.sessionId}
    />
  );
};

/**
 * Simple thread interface for development that doesn't use authentication
 */
const DevThreadInterface: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const {
    messages,
    isLoading,
    error,
    loadHistory,
    addMessage
  } = useDevThreadHistory({
    sessionId,
    autoLoad: false, // Disable auto-load to prevent infinite loop
    apiBaseUrl: 'http://localhost:3000'
  });

  const {
    scrollRef: messagesEndRef,
    scrollToBottom
  } = useAutoScroll({
    dependencies: [messages.length],
    enabled: true
  });

  const handleSendMessage = async (content: string): Promise<void> => {
    try {
      // For development, just add the message locally
      // In a real implementation, this would send to the backend
      const userMessage = {
        id: `user-${Date.now()}`,
        role: 'user' as const,
        content,
        ts: new Date().toISOString(),
        metadata: {}
      };
      
      addMessage(userMessage);
      
      // Simulate an amp response after a delay
      setTimeout(() => {
        const ampMessage = {
          id: `amp-${Date.now()}`,
          role: 'amp' as const,
          content: `Echo: ${content} (This is a development response)`,
          ts: new Date().toISOString(),
          metadata: {}
        };
        addMessage(ampMessage);
      }, 1000);
      
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-red-400 mb-2">⚠️ Thread Error</div>
          <div className="text-sm text-gray-400">{error.message}</div>
          <button
            onClick={() => loadHistory()}
            className="mt-2 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-900 text-white">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {isLoading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="mb-4">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
              <p className="text-gray-400">Loading messages...</p>
            </div>
          </div>
        ) : (
          <>
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-gray-400 mb-2">💬 Development Thread</div>
                  <div className="text-sm text-gray-500">Start a conversation with amp</div>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  className="mb-4"
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Scroll to bottom button */}
      <div className="px-4 py-2 bg-gray-800/50 border-t border-gray-700/50">
        <button
          onClick={scrollToBottom}
          className="text-sm text-blue-400 hover:text-blue-300 flex items-center space-x-1"
        >
          <span>↓</span>
          <span>Scroll to bottom</span>
        </button>
      </div>

      {/* Message Input */}
      <div className="border-t border-gray-700/50 bg-gray-800/30">
        <MessageInput
          onSendMessage={handleSendMessage}
          disabled={false}
          placeholder="Send a message to amp..."
          className="w-full"
        />
      </div>
    </div>
  );
};

export default DevThreadView;
