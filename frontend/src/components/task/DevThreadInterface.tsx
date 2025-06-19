import React, { useState, useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import useAutoScroll from '../../hooks/useAutoScroll';
import { ThreadMessage } from '../../types/threadMessage';

interface DevThreadInterfaceProps {
  sessionId: string;
  onNewThread?: () => void;
}

/**
 * Standalone thread interface for development - no complex hooks
 */
const DevThreadInterface: React.FC<DevThreadInterfaceProps> = ({ sessionId, onNewThread }) => {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const mountedRef = useRef(true);

  const {
    scrollRef: messagesEndRef,
    scrollToBottom
  } = useAutoScroll({
    dependencies: [messages.length],
    enabled: true
  });

  // Cleanup on unmount and reset initialization state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Reset initialization state on unmount so it can initialize again
      setIsInitialized(false);
    };
  }, []);

  // Load messages once on mount
  useEffect(() => {
    if (sessionId && !isInitialized && mountedRef.current) {
      setIsInitialized(true);
      loadMessages();
    }
  }, [sessionId, isInitialized]);

  const loadMessages = async () => {
    try {
      console.log('Loading messages for session:', sessionId, 'mounted:', mountedRef.current);
      setIsLoading(true);
      
      const response = await fetch(`http://localhost:3000/api/dev/thread/${sessionId}/messages`);
      if (!response.ok) {
        throw new Error(`Failed to load messages: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Messages loaded:', data, 'mounted:', mountedRef.current);
      
      if (mountedRef.current) {
        // Convert API messages to ThreadMessage format
        const convertedMessages: ThreadMessage[] = data.messages.map((msg: any) => ({
          id: msg.id,
          role: msg.type === 'user' ? 'user' : 'amp',
          content: msg.content,
          ts: msg.timestamp,
          metadata: msg.metadata || {}
        }));
        
        console.log('Setting messages and clearing error, mounted:', mountedRef.current);
        setMessages(convertedMessages);
        setError(null);
      } else {
        console.log('Component unmounted, not setting messages');
      }
    } catch (err) {
      console.error('Failed to load messages:', err, 'mounted:', mountedRef.current);
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load messages');
      }
    } finally {
      console.log('Finally block, setting isLoading to false, mounted:', mountedRef.current);
      // Always clear loading state, but only if component is still mounted
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handleSendMessage = async (content: string): Promise<void> => {
    try {
      console.log('Sending message:', content);
      
      // Add the user message immediately to show it in the UI
      const userMessage: ThreadMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: content,
        ts: new Date().toISOString(),
        metadata: {}
      };

      if (mountedRef.current) {
        setMessages(prev => [...prev, userMessage]);
      }
      
      const response = await fetch(`http://localhost:3000/api/dev/thread/${sessionId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Message sent successfully:', data);
      
      if (data.success) {
        // Add the assistant response (user message was already added above)
        const assistantMessage: ThreadMessage = {
          id: `assistant-${Date.now()}`,
          role: 'amp',
          content: data.response || 'No response received',
          ts: new Date().toISOString(),
          metadata: {}
        };

        if (mountedRef.current) {
          setMessages(prev => [...prev, assistantMessage]);
        }
      } else {
        // Add error message
        const errorMessage: ThreadMessage = {
          id: `error-${Date.now()}`,
          role: 'system',
          content: `Error: ${data.message || 'Failed to get response from amp'}`,
          ts: new Date().toISOString(),
          metadata: {}
        };
        if (mountedRef.current) {
          setMessages(prev => [...prev, errorMessage]);
        }
      }
      
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Add error message to chat
      const errorMessage: ThreadMessage = {
        id: `error-${Date.now()}`,
        role: 'system',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
        ts: new Date().toISOString(),
        metadata: {}
      };
      if (mountedRef.current) {
        setMessages(prev => [...prev, errorMessage]);
      }
    }
  };

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-red-400 mb-2">⚠️ Thread Error</div>
          <div className="text-sm text-gray-400">{error}</div>
          <button
            onClick={() => {
              setError(null);
              loadMessages();
            }}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-900 text-white">
      {/* Header with New Thread Button */}
      {onNewThread && (
        <div className="border-b border-gray-700 p-4 flex justify-between items-center">
          <div className="text-sm text-gray-400">Session: {sessionId}</div>
          <button
            onClick={onNewThread}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
          >
            New Thread
          </button>
        </div>
      )}
      
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
                  <div className="text-xs text-gray-600 mt-2">Session: {sessionId}</div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                  />
                ))}
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-700 p-4">
        <MessageInput 
          onSendMessage={handleSendMessage}
          disabled={isLoading}
          placeholder="Type a message to amp..."
        />
      </div>
    </div>
  );
};

export default DevThreadInterface;
