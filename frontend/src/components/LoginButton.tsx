import React, { useState } from 'react';

interface LoginButtonProps {
  onLogin?: () => void;
  disabled?: boolean;
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const LoginButton: React.FC<LoginButtonProps> = ({
  onLogin,
  disabled = false,
  className = '',
  variant = 'primary',
  size = 'md',
  loading = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (disabled || isLoading || loading) return;

    setIsLoading(true);
    try {
      if (onLogin) {
        await onLogin();
      } else {
        // Default behavior: redirect to GitHub OAuth
        window.location.href = '/api/auth/github';
      }
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getVariantClasses = () => {
    switch (variant) {
      case 'primary':
        return 'bg-gray-800 hover:bg-gray-700 text-white border-gray-700 hover:border-gray-600';
      case 'secondary':
        return 'bg-gray-700 hover:bg-gray-600 text-white border-gray-600 hover:border-gray-500';
      case 'outline':
        return 'bg-transparent hover:bg-gray-800/50 text-gray-300 border-gray-600 hover:border-gray-500 hover:text-white';
      default:
        return 'bg-gray-800 hover:bg-gray-700 text-white border-gray-700 hover:border-gray-600';
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-3 py-2 text-sm';
      case 'md':
        return 'px-4 py-2 text-base';
      case 'lg':
        return 'px-6 py-3 text-lg';
      default:
        return 'px-4 py-2 text-base';
    }
  };

  const isButtonLoading = loading || isLoading;

  return (
    <button
      onClick={handleClick}
      disabled={disabled || isButtonLoading}
      className={`
        inline-flex items-center justify-center
        border rounded-lg font-medium
        transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900
        disabled:opacity-50 disabled:cursor-not-allowed
        ${getVariantClasses()}
        ${getSizeClasses()}
        ${className}
      `}
    >
      <div className="flex items-center space-x-2">
        {isButtonLoading ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
        <span>
          {isButtonLoading ? 'Signing in...' : 'Sign in with GitHub'}
        </span>
      </div>
    </button>
  );
};

export default LoginButton;
