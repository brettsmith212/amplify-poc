import React from 'react';
import { Tab, TabsProps, TabType } from '../../types/tabs';

// Icon components matching the mockup style
const ThreadIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg 
    className={className} 
    width="16" 
    height="16" 
    viewBox="0 0 16 16" 
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M0 2.5A1.5 1.5 0 0 1 1.5 1h11A1.5 1.5 0 0 1 14 2.5v6.086a1.5 1.5 0 0 1-.44 1.06L11.914 11.5a1.5 1.5 0 0 1-1.06.44H2.5A1.5 1.5 0 0 1 1 10.5v-8zM1.5 2a.5.5 0 0 0-.5.5v8a.5.5 0 0 0 .5.5h8.354a.5.5 0 0 0 .354-.146L12.854 8.5a.5.5 0 0 0 .146-.354V2.5a.5.5 0 0 0-.5-.5h-11z"/>
    <path d="M3.5 4.5a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1H4a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1H4a.5.5 0 0 1-.5-.5z"/>
  </svg>
);

const TerminalIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg 
    className={className} 
    width="16" 
    height="16" 
    viewBox="0 0 16 16" 
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H2z"/>
    <path d="M6.146 4.146a.5.5 0 0 1 .708 0L8.207 5.5 6.854 6.854a.5.5 0 1 1-.708-.708L7.293 5 6.146 3.854a.5.5 0 0 1 0-.708zM9 7.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3A.5.5 0 0 1 9 7.5z"/>
  </svg>
);

const GitDiffIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg 
    className={className} 
    width="16" 
    height="16" 
    viewBox="0 0 16 16" 
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M11.251.068a.5.5 0 0 1 .227.58L9.677 6.5H13a.5.5 0 0 1 .364.843l-8 8.5a.5.5 0 0 1-.842-.49L6.323 9.5H3a.5.5 0 0 1-.364-.843l8-8.5a.5.5 0 0 1 .615-.09zM4.157 8.5H7a.5.5 0 0 1 .478.647L6.11 13.59l5.732-6.09H9a.5.5 0 0 1-.478-.647L9.89 2.41 4.157 8.5z"/>
  </svg>
);

const TABS: Tab[] = [
  { id: 'thread', label: 'Thread', icon: ThreadIcon },
  { id: 'terminal', label: 'Terminal', icon: TerminalIcon },
  { id: 'gitdiff', label: 'Git Diff', icon: GitDiffIcon },
];

export const TaskTabs: React.FC<TabsProps> = ({ 
  activeTab, 
  onTabChange, 
  className = '' 
}) => {
  const handleTabClick = (tabId: TabType) => {
    onTabChange(tabId);
  };

  const handleKeyDown = (event: React.KeyboardEvent, tabId: TabType) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onTabChange(tabId);
    }
  };

  return (
    <div className={`flex border-b border-gray-700/50 bg-gray-900/50 backdrop-blur ${className}`}>
      <div className="flex space-x-0">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, tab.id)}
              disabled={tab.disabled}
              className={`
                relative flex items-center space-x-2 px-4 py-3 text-sm font-medium
                transition-all duration-200 ease-in-out
                focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-0
                disabled:opacity-50 disabled:cursor-not-allowed
                ${isActive
                  ? 'text-blue-400 bg-gray-800/60 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'
                }
              `}
              aria-selected={isActive}
              role="tab"
              tabIndex={isActive ? 0 : -1}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-gray-400'}`} />
              <span>{tab.label}</span>
              
              {/* Active tab indicator line */}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400 rounded-t-sm" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TaskTabs;
