import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const Layout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isActivePath = (path: string) => {
    return location.pathname === path;
  };

  return (
    <div className="h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 text-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-gray-800/80 backdrop-blur border-b border-gray-700/50 px-6 py-4 shadow-lg">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full shadow-lg"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full shadow-lg"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full shadow-lg"></div>
            </div>
            <div className="h-6 w-px bg-gray-600"></div>
            <div>
              <Link to="/" className="text-lg font-semibold text-white hover:text-gray-300 transition-colors">
                Amplify
              </Link>
              <p className="text-xs text-gray-400">AI-Powered Development Environment</p>
            </div>
          </div>
          
          {/* Navigation */}
          {user && (
            <nav className="flex items-center space-x-6">
              <Link
                to="/sessions"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActivePath('/sessions')
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                Sessions
              </Link>
              <Link
                to="/create-session"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActivePath('/create-session')
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                Create Session
              </Link>
            </nav>
          )}

          {/* User Menu */}
          <div className="flex items-center space-x-3 text-sm text-gray-400">
            {user ? (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <img
                    src={user.avatarUrl}
                    alt={user.username}
                    className="w-6 h-6 rounded-full"
                  />
                  <span className="text-gray-300">{user.username}</span>
                </div>
                <button
                  onClick={logout}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                <span>Not authenticated</span>
              </div>
            )}
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
      
      {/* Status Bar */}
      <footer className="bg-gray-800/60 backdrop-blur border-t border-gray-700/50 px-6 py-3 shadow-lg">
        <div className="flex items-center justify-between text-sm max-w-7xl mx-auto">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">Status:</span>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-green-400 font-medium">Server Running</span>
              </div>
            </div>
            <div className="h-4 w-px bg-gray-600"></div>
            <div className="flex items-center space-x-2 text-gray-400">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              <span>Service active</span>
            </div>
          </div>
          <div className="text-gray-500 font-mono text-xs">
            Amplify POC v0.2.0
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
