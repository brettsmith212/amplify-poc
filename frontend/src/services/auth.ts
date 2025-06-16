import { api } from '../utils/api';

export interface User {
  id: number;
  login: string;
  name: string;
  email: string;
  avatar_url: string;
}

export interface AuthResponse {
  user: User;
  success: boolean;
  message?: string;
}

export interface AuthError {
  error: string;
  message: string;
  statusCode?: number;
}

class AuthService {
  /**
   * Check if user is currently authenticated
   */
  async checkAuthStatus(): Promise<User | null> {
    try {
      const response = await api.get('/auth/user');
      
      if (response.ok) {
        const userData = await response.json();
        return userData;
      }
      
      return null;
    } catch (error) {
      console.error('Auth status check failed:', error);
      return null;
    }
  }

  /**
   * Initiate GitHub OAuth login
   */
  async initiateGitHubLogin(): Promise<void> {
    try {
      // Store the current location to redirect back after login
      const returnUrl = window.location.pathname;
      if (returnUrl !== '/login') {
        sessionStorage.setItem('returnUrl', returnUrl);
      }

      // Redirect to GitHub OAuth
      window.location.href = '/api/auth/github';
    } catch (error) {
      console.error('Failed to initiate GitHub login:', error);
      throw new Error('Failed to start login process');
    }
  }

  /**
   * Handle OAuth callback and extract user data
   */
  async handleAuthCallback(): Promise<AuthResponse> {
    try {
      const response = await api.get('/auth/user');
      
      if (response.ok) {
        const userData = await response.json();
        
        // Clear any stored return URL
        sessionStorage.removeItem('returnUrl');
        
        return {
          user: userData,
          success: true,
          message: 'Login successful'
        };
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Authentication failed');
      }
    } catch (error) {
      console.error('Auth callback handling failed:', error);
      return {
        user: {} as User,
        success: false,
        message: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
      
      // Clear any stored user data
      sessionStorage.removeItem('returnUrl');
      
      // Redirect to login page
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
      // Even if logout request fails, redirect to login
      window.location.href = '/login';
    }
  }

  /**
   * Get the return URL after successful login
   */
  getReturnUrl(): string {
    return sessionStorage.getItem('returnUrl') || '/sessions';
  }

  /**
   * Clear the return URL
   */
  clearReturnUrl(): void {
    sessionStorage.removeItem('returnUrl');
  }

  /**
   * Parse URL parameters for OAuth callback handling
   */
  parseCallbackParams(): { code?: string; error?: string; error_description?: string } {
    const urlParams = new URLSearchParams(window.location.search);
    const params: { code?: string; error?: string; error_description?: string } = {};
    
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');
    
    if (code) params.code = code;
    if (error) params.error = error;
    if (errorDescription) params.error_description = errorDescription;
    
    return params;
  }

  /**
   * Check if current URL is an OAuth callback
   */
  isOAuthCallback(): boolean {
    const params = this.parseCallbackParams();
    return !!(params.code || params.error);
  }
}

export const authService = new AuthService();
export default authService;
