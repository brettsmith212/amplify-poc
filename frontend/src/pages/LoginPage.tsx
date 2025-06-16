import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoginButton from '../components/LoginButton';
import authService from '../services/auth';

const LoginPage: React.FC = () => {
  const { user, loading, checkAuth } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);
  const [isHandlingCallback, setIsHandlingCallback] = useState(false);

  // Handle OAuth callback
  useEffect(() => {
    const handleOAuthCallback = async () => {
      if (authService.isOAuthCallback()) {
        setIsHandlingCallback(true);
        
        const params = authService.parseCallbackParams();
        
        if (params.error) {
          setAuthError(params.error_description || params.error);
          setIsHandlingCallback(false);
          return;
        }

        if (params.code) {
          try {
            const result = await authService.handleAuthCallback();
            if (result.success) {
              // Trigger auth check to update context
              await checkAuth();
            } else {
              setAuthError(result.message || 'Authentication failed');
            }
          } catch (error) {
            setAuthError(error instanceof Error ? error.message : 'Authentication failed');
          }
        }
        
        setIsHandlingCallback(false);
      }
    };

    handleOAuthCallback();
  }, [checkAuth]);

  // Redirect if already authenticated
  if (user && !loading) {
    const returnUrl = authService.getReturnUrl();
    authService.clearReturnUrl();
    return <Navigate to={returnUrl} replace />;
  }

  // Show loading state
  if (loading || isHandlingCallback) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <h2 className="text-xl font-semibold text-white mb-2">
            {isHandlingCallback ? 'Completing sign-in...' : 'Loading...'}
          </h2>
          <p className="text-gray-400">
            {isHandlingCallback ? 'Please wait while we sign you in' : 'Checking authentication status'}
          </p>
        </div>
      </div>
    );
  }

  const handleLogin = async () => {
    try {
      setAuthError(null);
      await authService.initiateGitHubLogin();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Failed to start login process');
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          {/* Logo/Brand */}
          <div className="flex items-center justify-center mb-6">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-red-500 rounded-full shadow-lg"></div>
              <div className="w-4 h-4 bg-yellow-500 rounded-full shadow-lg"></div>
              <div className="w-4 h-4 bg-green-500 rounded-full shadow-lg"></div>
            </div>
          </div>
          
          <h1 className="text-3xl font-bold text-white mb-3">
            Welcome to Amplify
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed">
            Your AI-powered development environment in the cloud. 
            Connect your GitHub repositories and start coding with intelligent assistance.
          </p>
        </div>

        {/* Error Message */}
        {authError && (
          <div className="bg-red-900/50 border border-red-500/50 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path>
              </svg>
              <div>
                <h3 className="text-red-200 font-medium">Authentication Error</h3>
                <p className="text-red-300 text-sm mt-1">{authError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Login Form */}
        <div className="bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-xl p-8 shadow-2xl">
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-white mb-2">Sign In</h2>
              <p className="text-gray-400 text-sm">
                Sign in with your GitHub account to access your repositories and create development sessions.
              </p>
            </div>

            <LoginButton
              onLogin={handleLogin}
              size="lg"
              className="w-full"
            />

            <div className="text-center">
              <p className="text-gray-500 text-xs">
                By signing in, you agree to our terms of service and privacy policy.
              </p>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mt-8 space-y-4">
          <h3 className="text-lg font-semibold text-white text-center mb-4">
            What you can do with Amplify
          </h3>
          <div className="grid grid-cols-1 gap-3">
            <div className="flex items-center space-x-3 text-gray-300">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              <span className="text-sm">Clone and work with any GitHub repository</span>
            </div>
            <div className="flex items-center space-x-3 text-gray-300">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span className="text-sm">AI-powered coding assistance with context awareness</span>
            </div>
            <div className="flex items-center space-x-3 text-gray-300">
              <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
              <span className="text-sm">Real-time terminal access in containerized environments</span>
            </div>
            <div className="flex items-center space-x-3 text-gray-300">
              <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
              <span className="text-sm">Visual diff viewer and seamless Git operations</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
