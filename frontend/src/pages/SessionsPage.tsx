import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSessions, SessionStatus } from '../hooks/useSessions';
import { SessionCard } from '../components/SessionCard';

export const SessionsPage: React.FC = () => {
  const {
    sessions,
    loading,
    error,
    refreshSessions,
    deleteSession,
    startSession,
    stopSession
  } = useSessions();

  const [filter, setFilter] = useState<'all' | SessionStatus>('all');

  const filteredSessions = sessions.filter(session => 
    filter === 'all' || session.status === filter
  );

  const getFilterCounts = () => {
    const counts = {
      all: sessions.length,
      running: 0,
      ready: 0,
      idle: 0,
      stopped: 0,
      error: 0,
    };

    sessions.forEach(session => {
      switch (session.status) {
        case SessionStatus.RUNNING:
          counts.running++;
          break;
        case SessionStatus.READY:
          counts.ready++;
          break;
        case SessionStatus.IDLE:
          counts.idle++;
          break;
        case SessionStatus.STOPPED:
          counts.stopped++;
          break;
        case SessionStatus.ERROR:
          counts.error++;
          break;
      }
    });

    return counts;
  };

  const filterCounts = getFilterCounts();

  const handleRefresh = async () => {
    await refreshSessions();
  };

  if (loading && sessions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-slate-900 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-6">
              <div className="w-8 h-8 animate-spin border-2 border-white border-t-transparent rounded-full" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Loading your sessions...
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              Please wait while we fetch your coding sessions
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-slate-900 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Your Sessions
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Manage and access your coding sessions
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 transition-all duration-200"
            >
              <svg 
                className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            
            <Link
              to="/create-session"
              className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              New Session
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                filter === 'all'
                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              All Sessions
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-white rounded-full">
                {filterCounts.all}
              </span>
            </button>

            <button
              onClick={() => setFilter(SessionStatus.RUNNING)}
              className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                filter === SessionStatus.RUNNING
                  ? 'bg-green-100 text-green-800 border border-green-200'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
              Running
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-white rounded-full">
                {filterCounts.running}
              </span>
            </button>

            <button
              onClick={() => setFilter(SessionStatus.READY)}
              className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                filter === SessionStatus.READY
                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2" />
              Ready
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-white rounded-full">
                {filterCounts.ready}
              </span>
            </button>

            <button
              onClick={() => setFilter(SessionStatus.IDLE)}
              className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                filter === SessionStatus.IDLE
                  ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2" />
              Idle
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-white rounded-full">
                {filterCounts.idle}
              </span>
            </button>

            <button
              onClick={() => setFilter(SessionStatus.STOPPED)}
              className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                filter === SessionStatus.STOPPED
                  ? 'bg-gray-100 text-gray-800 border border-gray-200'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <div className="w-2 h-2 bg-gray-500 rounded-full mr-2" />
              Stopped
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-white rounded-full">
                {filterCounts.stopped}
              </span>
            </button>

            {filterCounts.error > 0 && (
              <button
                onClick={() => setFilter(SessionStatus.ERROR)}
                className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                  filter === SessionStatus.ERROR
                    ? 'bg-red-100 text-red-800 border border-red-200'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <div className="w-2 h-2 bg-red-500 rounded-full mr-2" />
                Error
                <span className="ml-2 px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-white rounded-full">
                  {filterCounts.error}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  Error loading sessions
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  {error}
                </p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="text-red-600 hover:text-red-500"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Sessions Grid */}
        {filteredSessions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onStart={startSession}
                onStop={stopSession}
                onDelete={deleteSession}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-6">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            
            {sessions.length === 0 ? (
              <>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  No sessions yet
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Create your first coding session to get started
                </p>
                <Link
                  to="/create-session"
                  className="inline-flex items-center px-6 py-3 text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create Your First Session
                </Link>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  No {filter} sessions
                </h2>
                <p className="text-gray-600 dark:text-gray-300">
                  Try a different filter or create a new session
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionsPage;
