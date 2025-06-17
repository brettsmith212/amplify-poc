import React from 'react';
import { Session, SessionStatus } from '../hooks/useSessions';
import { SessionActions } from './SessionActions';

interface SessionCardProps {
  session: Session;
  onStart: (sessionId: string) => Promise<boolean>;
  onStop: (sessionId: string) => Promise<boolean>;
  onDelete: (sessionId: string) => Promise<boolean>;
  className?: string;
}

export const SessionCard: React.FC<SessionCardProps> = ({
  session,
  onStart,
  onStop,
  onDelete,
  className = ""
}) => {
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getStatusColor = (status: SessionStatus): string => {
    switch (status) {
      case SessionStatus.RUNNING:
        return 'bg-green-100 text-green-800 border-green-200';
      case SessionStatus.READY:
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case SessionStatus.IDLE:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case SessionStatus.STOPPED:
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case SessionStatus.ERROR:
        return 'bg-red-100 text-red-800 border-red-200';
      case SessionStatus.CREATING:
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case SessionStatus.STOPPING:
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: SessionStatus): JSX.Element => {
    switch (status) {
      case SessionStatus.RUNNING:
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
          </svg>
        );
      case SessionStatus.READY:
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case SessionStatus.IDLE:
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
        );
      case SessionStatus.STOPPED:
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 012 0v6a1 1 0 11-2 0V7z" clipRule="evenodd" />
          </svg>
        );
      case SessionStatus.ERROR:
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      case SessionStatus.CREATING:
        return (
          <div className="w-4 h-4 animate-spin border-2 border-purple-600 border-t-transparent rounded-full" />
        );
      case SessionStatus.STOPPING:
        return (
          <div className="w-4 h-4 animate-spin border-2 border-orange-600 border-t-transparent rounded-full" />
        );
      default:
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  const expiresAt = new Date(session.expiresAt);
  const now = new Date();
  const timeUntilExpiry = expiresAt.getTime() - now.getTime();
  const hoursUntilExpiry = Math.floor(timeUntilExpiry / (1000 * 60 * 60));
  const isExpiringSoon = hoursUntilExpiry < 24 && hoursUntilExpiry > 0;
  const isExpired = timeUntilExpiry <= 0;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200 ${className}`}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-3 mb-2">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
                  {session.repositoryName}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Branch: <span className="font-medium">{session.branch}</span>
                </p>
              </div>
            </div>
          </div>
          
          {/* Status Badge */}
          <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(session.status)}`}>
            {getStatusIcon(session.status)}
            <span className="ml-1.5 capitalize">{session.status}</span>
          </div>
        </div>



        {/* Metadata */}
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Created {formatRelativeTime(session.createdAt)}</span>
            </div>
            
            <div className="flex items-center space-x-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span>Active {formatRelativeTime(session.lastAccessedAt)}</span>
            </div>

            {session.metadata.connectionCount !== undefined && (
              <div className="flex items-center space-x-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                </svg>
                <span>{session.metadata.connectionCount || 0} connections</span>
              </div>
            )}
          </div>
        </div>

        {/* Expiry Warning */}
        {isExpired && (
          <div className="mb-4 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-xs font-medium text-red-800 dark:text-red-200">Session expired</span>
            </div>
          </div>
        )}

        {isExpiringSoon && !isExpired && (
          <div className="mb-4 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-xs font-medium text-yellow-800 dark:text-yellow-200">
                Expires in {hoursUntilExpiry}h
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end">
          <SessionActions
            session={session}
            onStart={onStart}
            onStop={onStop}
            onDelete={onDelete}
            disabled={isExpired}
          />
        </div>
      </div>
    </div>
  );
};

export default SessionCard;
