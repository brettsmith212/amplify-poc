import { useState, useCallback } from 'react';

export interface ErrorState {
  message: string;
  code?: string | number;
  details?: any;
  timestamp: number;
}

export interface UseErrorReturn {
  error: ErrorState | null;
  setError: (error: Error | string | ErrorState | null) => void;
  clearError: () => void;
  hasError: boolean;
}

export const useError = (): UseErrorReturn => {
  const [error, setErrorState] = useState<ErrorState | null>(null);

  const setError = useCallback((error: Error | string | ErrorState | null) => {
    if (!error) {
      setErrorState(null);
      return;
    }

    if (typeof error === 'string') {
      setErrorState({
        message: error,
        timestamp: Date.now(),
      });
    } else if (error instanceof Error) {
      setErrorState({
        message: error.message,
        code: error.name,
        details: error.stack,
        timestamp: Date.now(),
      });
    } else {
      setErrorState({
        ...error,
        timestamp: error.timestamp || Date.now(),
      });
    }
  }, []);

  const clearError = useCallback(() => {
    setErrorState(null);
  }, []);

  return {
    error,
    setError,
    clearError,
    hasError: !!error,
  };
};

export const formatError = (error: unknown): string => {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    if ('message' in error && typeof error.message === 'string') {
      return error.message;
    }
    
    if ('error' in error && typeof error.error === 'string') {
      return error.error;
    }
  }

  return 'An unexpected error occurred';
};

export const handleApiError = (error: any): ErrorState => {
  // Handle different types of API errors
  if (error?.response) {
    // HTTP error response
    const status = error.response.status;
    const data = error.response.data;
    
    let message = 'An error occurred';
    
    if (data?.message) {
      message = data.message;
    } else if (data?.error) {
      message = data.error;
    } else {
      switch (status) {
        case 400:
          message = 'Bad request. Please check your input.';
          break;
        case 401:
          message = 'Authentication required. Please log in.';
          break;
        case 403:
          message = 'Permission denied. You do not have access to this resource.';
          break;
        case 404:
          message = 'Resource not found.';
          break;
        case 429:
          message = 'Too many requests. Please try again later.';
          break;
        case 500:
          message = 'Server error. Please try again later.';
          break;
        default:
          message = `HTTP ${status}: ${error.response.statusText || 'Unknown error'}`;
      }
    }
    
    return {
      message,
      code: status,
      details: data,
      timestamp: Date.now(),
    };
  }
  
  if (error?.request) {
    // Network error
    return {
      message: 'Network error. Please check your connection and try again.',
      code: 'NETWORK_ERROR',
      timestamp: Date.now(),
    };
  }
  
  // Other error
  return {
    message: formatError(error),
    timestamp: Date.now(),
  };
};

export default useError;
