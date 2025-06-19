import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Terminal from '../components/Terminal';
import ThreadView from '../components/task/ThreadView';
import TaskTabs from '../components/task/TaskTabs';
import { TabType } from '../types/tabs';

const TerminalPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('terminal');

  const handleViewDiff = () => {
    if (sessionId) {
      navigate(`/diff/${sessionId}`);
    }
  };

  const handleTabChange = (tab: TabType) => {
    if (tab === 'gitdiff') {
      handleViewDiff();
      return;
    }
    setActiveTab(tab);
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case 'thread':
        return 'conversation';
      case 'terminal':
        return 'terminal';
      case 'gitdiff':
        return 'git diff';
      default:
        return 'terminal';
    }
  };

  const renderActiveContent = () => {
    if (!sessionId) {
      return (
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <div className="text-lg font-medium mb-2">No Session</div>
            <div className="text-sm">Please select or create a session to continue.</div>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'thread':
        return (
          <ThreadView 
            sessionId={sessionId}
            className="h-full"
          />
        );
      case 'terminal':
        return (
          <Terminal 
            className="h-full w-full"
            sessionId={sessionId}
            onReady={(_terminal) => {
              // Terminal ready
            }}
            onData={(_data) => {
              // Terminal input received
            }}
            onResize={(_dimensions) => {
              // Terminal resized
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 max-w-7xl mx-auto w-full">
      <div className="flex-1 bg-gray-900 rounded-xl border border-gray-700/50 overflow-hidden relative shadow-2xl flex flex-col">
        {/* Window Header */}
        <div className="bg-gray-800/60 border-b border-gray-700/50 px-4 py-2 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="flex space-x-1.5">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            <span className="text-sm text-gray-400 font-medium">{getTabTitle()}</span>
            {sessionId && (
              <span className="text-xs text-gray-500 bg-gray-700/50 px-2 py-1 rounded">
                Session: {sessionId}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-xs text-gray-500">amplify@container:/workspace</div>
            <button
              onClick={handleViewDiff}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-300 bg-gray-700/50 border border-gray-600 rounded-lg hover:bg-gray-600/50 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              View Diff
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <TaskTabs 
          activeTab={activeTab}
          onTabChange={handleTabChange}
          className="flex-shrink-0"
        />
        
        {/* Tab Content */}
        <div className="flex-1 bg-gray-900 overflow-hidden">
          {renderActiveContent()}
        </div>
      </div>
    </div>
  );
};

export default TerminalPage;
