import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Session, SessionStatus } from '../hooks/useSessions';

interface SessionActionsProps {
  session: Session;
  onStart: (sessionId: string) => Promise<boolean>;
  onStop: (sessionId: string) => Promise<boolean>;
  onDelete: (sessionId: string) => Promise<boolean>;
  disabled?: boolean;
}

export const SessionActions: React.FC<SessionActionsProps> = ({
  session,
  onStart,
  onStop,
  onDelete,
  disabled = false
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);

  const handleAction = async (action: string, handler: () => Promise<boolean>) => {
    setLoading(action);
    try {
      await handler();
    } finally {
      setLoading(null);
    }
  };

  const handleOpenTerminal = () => {
    navigate(`/terminal/${session.id}`);
  };

  const handleViewDiff = () => {
    navigate(`/diff/${session.id}`);
  };

  const handleStart = () => handleAction('start', () => onStart(session.id));
  const handleStop = () => handleAction('stop', () => onStop(session.id));
  const handleDelete = () => handleAction('delete', () => onDelete(session.id));

  const canStart = [SessionStatus.READY, SessionStatus.IDLE, SessionStatus.STOPPED].includes(session.status);
  const canStop = [SessionStatus.RUNNING, SessionStatus.IDLE].includes(session.status);
  const canOpenTerminal = [SessionStatus.READY, SessionStatus.RUNNING, SessionStatus.IDLE].includes(session.status);
  const canDelete = session.status !== SessionStatus.CREATING && session.status !== SessionStatus.STOPPING;

  return (
    <div className="flex items-center space-x-2">
      {/* Open Terminal */}
      {canOpenTerminal && (
        <button
          onClick={handleOpenTerminal}
          disabled={disabled}
          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Open
        </button>
      )}

      {/* View Diff */}
      <button
        onClick={handleViewDiff}
        disabled={disabled}
        className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
      >
        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        View Diff
      </button>

      {/* Start Session */}
      {canStart && (
        <button
          onClick={handleStart}
          disabled={disabled || loading === 'start'}
          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          {loading === 'start' ? (
            <div className="w-4 h-4 mr-1.5 animate-spin border-2 border-green-600 border-t-transparent rounded-full" />
          ) : (
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1" />
            </svg>
          )}
          Start
        </button>
      )}

      {/* Stop Session */}
      {canStop && (
        <button
          onClick={handleStop}
          disabled={disabled || loading === 'stop'}
          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-orange-700 bg-orange-100 rounded-lg hover:bg-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          {loading === 'stop' ? (
            <div className="w-4 h-4 mr-1.5 animate-spin border-2 border-orange-600 border-t-transparent rounded-full" />
          ) : (
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
          )}
          Stop
        </button>
      )}

      {/* Delete Session */}
      {canDelete && (
        <button
          onClick={handleDelete}
          disabled={disabled || loading === 'delete'}
          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          {loading === 'delete' ? (
            <div className="w-4 h-4 mr-1.5 animate-spin border-2 border-red-600 border-t-transparent rounded-full" />
          ) : (
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          )}
          Delete
        </button>
      )}
    </div>
  );
};

export default SessionActions;
