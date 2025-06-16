import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import LoginPage from '../pages/LoginPage';
import { AuthProvider } from '../contexts/AuthContext';
import authService from '../services/auth';

// Mock the auth service
vi.mock('../services/auth', () => ({
  default: {
    isOAuthCallback: vi.fn(() => false),
    parseCallbackParams: vi.fn(() => ({})),
    handleAuthCallback: vi.fn(),
    initiateGitHubLogin: vi.fn(),
    getReturnUrl: vi.fn(() => '/sessions'),
    clearReturnUrl: vi.fn(),
  },
}));

// Mock the API
vi.mock('../utils/api', () => ({
  api: {
    get: vi.fn(() => Promise.resolve({
      ok: false,
      json: () => Promise.resolve({ error: 'Not authenticated' })
    })),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <BrowserRouter>
      <AuthProvider>
        {children}
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.location.href setter
    Object.defineProperty(window, 'location', {
      value: {
        href: '',
        pathname: '/login',
        search: '',
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the login page with welcome message', async () => {
    render(
      <TestWrapper>
        <LoginPage />
      </TestWrapper>
    );

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Welcome to Amplify')).toBeInTheDocument();
    expect(screen.getByText(/Your AI-powered development environment/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign in with GitHub/i })).toBeInTheDocument();
  });

  it('displays features list', async () => {
    render(
      <TestWrapper>
        <LoginPage />
      </TestWrapper>
    );

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    expect(screen.getByText('What you can do with Amplify')).toBeInTheDocument();
    expect(screen.getByText(/Clone and work with any GitHub repository/)).toBeInTheDocument();
    expect(screen.getByText(/AI-powered coding assistance/)).toBeInTheDocument();
    expect(screen.getByText(/Real-time terminal access/)).toBeInTheDocument();
    expect(screen.getByText(/Visual diff viewer/)).toBeInTheDocument();
  });

  it('calls authService.initiateGitHubLogin when login button is clicked', async () => {
    const mockInitiateLogin = vi.mocked(authService.initiateGitHubLogin);
    
    render(
      <TestWrapper>
        <LoginPage />
      </TestWrapper>
    );

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const loginButton = screen.getByRole('button', { name: /Sign in with GitHub/i });
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(mockInitiateLogin).toHaveBeenCalledTimes(1);
    });
  });

  it('displays error message when authentication fails', async () => {
    const mockInitiateLogin = vi.mocked(authService.initiateGitHubLogin);
    mockInitiateLogin.mockRejectedValueOnce(new Error('Login failed'));

    render(
      <TestWrapper>
        <LoginPage />
      </TestWrapper>
    );

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const loginButton = screen.getByRole('button', { name: /Sign in with GitHub/i });
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(screen.getByText('Authentication Error')).toBeInTheDocument();
      expect(screen.getByText('Login failed')).toBeInTheDocument();
    });
  });

  it('handles OAuth callback with error', async () => {
    const mockIsOAuthCallback = vi.mocked(authService.isOAuthCallback);
    const mockParseCallbackParams = vi.mocked(authService.parseCallbackParams);
    
    mockIsOAuthCallback.mockReturnValueOnce(true);
    mockParseCallbackParams.mockReturnValueOnce({
      error: 'access_denied',
      error_description: 'User denied access'
    });

    render(
      <TestWrapper>
        <LoginPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Authentication Error')).toBeInTheDocument();
      expect(screen.getByText('User denied access')).toBeInTheDocument();
    });
  });

  it('handles OAuth callback with success', async () => {
    const mockIsOAuthCallback = vi.mocked(authService.isOAuthCallback);
    const mockParseCallbackParams = vi.mocked(authService.parseCallbackParams);
    const mockHandleAuthCallback = vi.mocked(authService.handleAuthCallback);
    
    mockIsOAuthCallback.mockReturnValueOnce(true);
    mockParseCallbackParams.mockReturnValueOnce({
      code: 'auth_code_123'
    });
    mockHandleAuthCallback.mockResolvedValueOnce({
      success: true,
      user: {
      id: 1,
      username: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
      avatarUrl: 'https://github.com/avatar.jpg'
      },
      message: 'Login successful'
    });

    render(
      <TestWrapper>
        <LoginPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(mockHandleAuthCallback).toHaveBeenCalledTimes(1);
    });
  });

  it('shows loading state during OAuth callback handling', () => {
    const mockIsOAuthCallback = vi.mocked(authService.isOAuthCallback);
    const mockParseCallbackParams = vi.mocked(authService.parseCallbackParams);
    
    mockIsOAuthCallback.mockReturnValueOnce(true);
    mockParseCallbackParams.mockReturnValueOnce({
      code: 'auth_code_123'
    });

    render(
      <TestWrapper>
        <LoginPage />
      </TestWrapper>
    );

    expect(screen.getByText('Completing sign-in...')).toBeInTheDocument();
    expect(screen.getByText('Please wait while we sign you in')).toBeInTheDocument();
  });

  it('displays privacy notice', async () => {
    render(
      <TestWrapper>
        <LoginPage />
      </TestWrapper>
    );

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    expect(screen.getByText(/By signing in, you agree to our terms of service/)).toBeInTheDocument();
  });
});
