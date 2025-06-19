import React, { useState, useEffect } from 'react';
import { getThreadHistory, DevSessionData } from '../../services/devSession';

interface ThreadInfo extends DevSessionData {
  lastAccessed: string;
  messageCount?: number;
  lastMessage?: {
    content: string;
    timestamp: string;
    type: string;
  } | null;
}

interface ThreadSidebarProps {
  currentSessionId: string;
  onSelectThread: (sessionData: DevSessionData) => void;
  onNewThread: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

const ThreadSidebar: React.FC<ThreadSidebarProps> = ({
  currentSessionId,
  onSelectThread,
  onNewThread,
  isOpen,
  onToggle
}) => {
  const [threads, setThreads] = useState<ThreadInfo[]>([]);
  const [backendThreads, setBackendThreads] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load thread history from localStorage and backend
  useEffect(() => {
    const localThreads = getThreadHistory();
    setThreads(localThreads);
    
    // Also fetch from backend for additional info
    fetchBackendThreads();
  }, []);

  const fetchBackendThreads = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('http://localhost:3000/api/dev/thread/sessions');
      if (response.ok) {
        const data = await response.json();
        setBackendThreads(data.sessions || []);
      }
    } catch (error) {
      console.error('Failed to fetch backend threads:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getThreadInfo = (thread: ThreadInfo) => {
    const backendInfo = backendThreads.find(bt => bt.sessionId === thread.sessionId);
    return {
      ...thread,
      messageCount: backendInfo?.messageCount || 0,
      lastMessage: backendInfo?.lastMessage
    };
  };

  if (!isOpen) {
    console.log('ThreadSidebar: Rendering hamburger button, isOpen =', isOpen);
    return (
      <button
        onClick={() => {
          console.log('ThreadSidebar: Hamburger button clicked');
          onToggle();
        }}
        className="fixed p-4 text-white rounded-lg transition-colors"
        title="Show thread history"
        style={{ 
          backgroundColor: 'red', 
          top: '20px',
          left: '20px',
          zIndex: 9999,
          border: '2px solid yellow',
          fontSize: '20px',
          width: '60px',
          height: '60px'
        }}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onToggle}
      />
      
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-80 bg-gray-900 text-white shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-lg font-semibold">Threads</h2>
          <button
            onClick={onToggle}
            className="p-1 hover:bg-gray-800 rounded"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* New Thread Button */}
        <div className="p-4 border-b border-gray-700">
          <button
            onClick={() => {
              onNewThread();
              onToggle();
            }}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            + New Thread
          </button>
        </div>

        {/* Thread List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="p-4 text-center text-gray-400">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <div className="mt-2">Loading threads...</div>
            </div>
          )}
          
          {threads.length === 0 && !isLoading && (
            <div className="p-4 text-center text-gray-400">
              No threads yet
            </div>
          )}

          {threads.map((thread) => {
            const threadInfo = getThreadInfo(thread);
            const isActive = thread.sessionId === currentSessionId;
            
            return (
              <button
                key={thread.sessionId}
                onClick={() => {
                  onSelectThread(thread);
                  onToggle();
                }}
                className={`w-full p-4 text-left hover:bg-gray-800 transition-colors border-b border-gray-800 ${
                  isActive ? 'bg-gray-800 border-l-4 border-l-blue-600' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="text-sm font-medium text-gray-300">
                    Thread {thread.sessionId.split('-').pop()?.substring(0, 6)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatTimestamp(thread.lastAccessed)}
                  </div>
                </div>
                
                {threadInfo.lastMessage && (
                  <div className="text-sm text-gray-400 mb-2">
                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                      threadInfo.lastMessage.type === 'user' ? 'bg-green-500' : 'bg-blue-500'
                    }`}></span>
                    {threadInfo.lastMessage.content}
                  </div>
                )}
                
                <div className="text-xs text-gray-500">
                  {threadInfo.messageCount} messages
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default ThreadSidebar;
