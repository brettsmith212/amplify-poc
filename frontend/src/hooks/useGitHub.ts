import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';

export interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  owner: {
    login: string;
    avatar_url: string;
  };
  clone_url: string;
  ssh_url: string;
  default_branch: string;
  updated_at: string;
  language: string | null;
}

export interface Branch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

export interface GitHubError {
  error: string;
  message: string;
}

export interface GitHubResponse<T> {
  success: boolean;
  data?: T;
  pagination?: {
    page: number;
    per_page: number;
    total?: number;
  };
  meta?: any;
}

export interface RepositoryFilters {
  type?: 'all' | 'owner' | 'member';
  sort?: 'created' | 'updated' | 'pushed' | 'full_name';
  direction?: 'asc' | 'desc';
  search?: string;
}

export interface PaginationOptions {
  page?: number;
  per_page?: number;
}

export const useGitHub = () => {
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const makeRequest = useCallback(async <T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<GitHubResponse<T>> => {
    if (!isAuthenticated) {
      throw new Error('User must be authenticated to access GitHub API');
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/github${endpoint}`, {
        credentials: 'include',
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'GitHub API request failed');
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const getRepositories = useCallback(async (
    filters: RepositoryFilters = {},
    pagination: PaginationOptions = {}
  ): Promise<GitHubResponse<Repository[]>> => {
    const searchParams = new URLSearchParams();
    
    if (filters.type) searchParams.set('type', filters.type);
    if (filters.sort) searchParams.set('sort', filters.sort);
    if (filters.direction) searchParams.set('direction', filters.direction);
    if (filters.search) searchParams.set('search', filters.search);
    if (pagination.page) searchParams.set('page', pagination.page.toString());
    if (pagination.per_page) searchParams.set('per_page', pagination.per_page.toString());

    const query = searchParams.toString();
    const endpoint = `/repos${query ? `?${query}` : ''}`;

    return makeRequest<Repository[]>(endpoint);
  }, [makeRequest]);

  const getRepository = useCallback(async (
    owner: string,
    repo: string
  ): Promise<GitHubResponse<Repository>> => {
    return makeRequest<Repository>(`/repos/${owner}/${repo}`);
  }, [makeRequest]);

  const getBranches = useCallback(async (
    owner: string,
    repo: string,
    pagination: PaginationOptions = {}
  ): Promise<GitHubResponse<Branch[]>> => {
    const searchParams = new URLSearchParams();
    
    if (pagination.page) searchParams.set('page', pagination.page.toString());
    if (pagination.per_page) searchParams.set('per_page', pagination.per_page.toString());

    const query = searchParams.toString();
    const endpoint = `/repos/${owner}/${repo}/branches${query ? `?${query}` : ''}`;

    return makeRequest<Branch[]>(endpoint);
  }, [makeRequest]);

  const validateRepositoryAccess = useCallback(async (
    owner: string,
    repo: string
  ): Promise<GitHubResponse<{ hasAccess: boolean; canClone: boolean; repository: string }>> => {
    return makeRequest<{ hasAccess: boolean; canClone: boolean; repository: string }>(
      `/repos/${owner}/${repo}/access`
    );
  }, [makeRequest]);

  const getRateLimit = useCallback(async (): Promise<GitHubResponse<any>> => {
    return makeRequest<any>('/rate-limit');
  }, [makeRequest]);

  // Helper function to search repositories with debouncing
  const searchRepositories = useCallback(async (
    query: string,
    options: { limit?: number } = {}
  ): Promise<Repository[]> => {
    if (!query.trim()) {
      return [];
    }

    try {
      const result = await getRepositories(
        { search: query, sort: 'updated', direction: 'desc' },
        { per_page: options.limit || 10 }
      );

      return result.data || [];
    } catch (err) {
      console.error('Error searching repositories:', err);
      return [];
    }
  }, [getRepositories]);

  // Helper function to parse repository URL and get owner/repo
  const parseRepositoryUrl = useCallback((url: string): { owner: string; repo: string } | null => {
    try {
      // Handle GitHub URLs in various formats
      const patterns = [
        /github\.com\/([^\/]+)\/([^\/]+)(?:\.git)?$/,  // https://github.com/owner/repo or https://github.com/owner/repo.git
        /github\.com:([^\/]+)\/([^\/]+)(?:\.git)?$/,   // git@github.com:owner/repo or git@github.com:owner/repo.git
        /^([^\/]+)\/([^\/]+)$/                         // owner/repo
      ];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1] && match[2]) {
          return { owner: match[1], repo: match[2] };
        }
      }

      return null;
    } catch {
      return null;
    }
  }, []);

  return {
    // State
    loading,
    error,

    // API methods
    getRepositories,
    getRepository,
    getBranches,
    validateRepositoryAccess,
    getRateLimit,

    // Helper methods
    searchRepositories,
    parseRepositoryUrl,

    // Utility to clear error state
    clearError: () => setError(null),
  };
};

export default useGitHub;
