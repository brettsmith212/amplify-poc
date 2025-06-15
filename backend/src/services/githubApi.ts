/**
 * GitHub API service with rate limiting and error handling
 */

import { GitHubService, createGitHubService } from './github';
import { AuthenticatedUser, GitHubRepository, GitHubBranch } from '../models/User';
import { logger } from '../utils/logger';

const githubApiLogger = logger.child('GitHubApiService');

export interface PaginationOptions {
  page?: number;
  per_page?: number;
}

export interface RepositoryFilters {
  type?: 'all' | 'owner' | 'member';
  sort?: 'created' | 'updated' | 'pushed' | 'full_name';
  direction?: 'asc' | 'desc';
  search?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    per_page: number;
    total?: number;
    has_next?: boolean;
    has_prev?: boolean;
  };
  rateLimit?: {
    limit: number;
    remaining: number;
    reset: Date;
  };
}

export class GitHubApiService {
  private githubService: GitHubService;
  private user: AuthenticatedUser;

  constructor(user: AuthenticatedUser) {
    this.user = user;
    this.githubService = createGitHubService(user);
  }

  /**
   * Get user's repositories with filtering and pagination
   */
  async getRepositories(
    filters: RepositoryFilters = {},
    pagination: PaginationOptions = {}
  ): Promise<ApiResponse<GitHubRepository[]>> {
    try {
      githubApiLogger.info('Fetching repositories', {
        userId: this.user.id,
        filters,
        pagination
      });

      // If search is provided, use search API
      if (filters.search) {
        return await this.searchUserRepositories(filters.search, filters, pagination);
      }

      const response = await this.githubService.getRepositories({
        ...(filters.type && { type: filters.type }),
        ...(filters.sort && { sort: filters.sort }),
        ...(filters.direction && { direction: filters.direction }),
        per_page: pagination.per_page || 30,
        page: pagination.page || 1
      });

      if (!response.success) {
        return {
          success: false,
          error: response.error || 'Unknown error'
        };
      }

      const repositories = response.data!;
      const page = pagination.page || 1;
      const per_page = pagination.per_page || 30;

      return {
        success: true,
        data: repositories,
        pagination: {
          page,
          per_page,
          has_next: repositories.length === per_page,
          has_prev: page > 1
        },
        ...(response.rateLimit && { rateLimit: response.rateLimit })
      };

    } catch (error: any) {
      githubApiLogger.error('Failed to fetch repositories', {
        userId: this.user.id,
        error: error.message,
        filters,
        pagination
      });

      return {
        success: false,
        error: 'Failed to fetch repositories'
      };
    }
  }

  /**
   * Search user's repositories
   */
  private async searchUserRepositories(
    query: string,
    filters: RepositoryFilters,
    pagination: PaginationOptions
  ): Promise<ApiResponse<GitHubRepository[]>> {
    try {
      // Build search query with user scope
      const searchQuery = `${query} user:${this.user.username}`;

      const response = await this.githubService.searchRepositories(searchQuery, {
        ...(filters.sort && filters.sort !== 'full_name' && { sort: filters.sort as any }),
        ...(filters.direction && { order: filters.direction }),
        per_page: pagination.per_page || 30,
        page: pagination.page || 1
      });

      if (!response.success) {
        return {
          success: false,
          error: response.error || 'Unknown error'
        };
      }

      const repositories = response.data!;
      const page = pagination.page || 1;
      const per_page = pagination.per_page || 30;

      return {
        success: true,
        data: repositories,
        pagination: {
          page,
          per_page,
          has_next: repositories.length === per_page,
          has_prev: page > 1
        },
        ...(response.rateLimit && { rateLimit: response.rateLimit })
      };

    } catch (error: any) {
      githubApiLogger.error('Failed to search repositories', {
        userId: this.user.id,
        query,
        error: error.message
      });

      return {
        success: false,
        error: 'Failed to search repositories'
      };
    }
  }

  /**
   * Get branches for a repository
   */
  async getBranches(
    owner: string,
    repo: string,
    pagination: PaginationOptions = {}
  ): Promise<ApiResponse<GitHubBranch[]>> {
    try {
      githubApiLogger.info('Fetching branches', {
        userId: this.user.id,
        owner,
        repo,
        pagination
      });

      const response = await this.githubService.getBranches(owner, repo, {
        per_page: pagination.per_page || 30,
        page: pagination.page || 1
      });

      if (!response.success) {
        return {
          success: false,
          error: response.error || 'Unknown error'
        };
      }

      const branches = response.data!;
      const page = pagination.page || 1;
      const per_page = pagination.per_page || 30;

      return {
        success: true,
        data: branches,
        pagination: {
          page,
          per_page,
          has_next: branches.length === per_page,
          has_prev: page > 1
        },
        ...(response.rateLimit && { rateLimit: response.rateLimit })
      };

    } catch (error: any) {
      githubApiLogger.error('Failed to fetch branches', {
        userId: this.user.id,
        owner,
        repo,
        error: error.message
      });

      return {
        success: false,
        error: 'Failed to fetch branches'
      };
    }
  }

  /**
   * Get a specific repository
   */
  async getRepository(owner: string, repo: string): Promise<ApiResponse<GitHubRepository>> {
    try {
      githubApiLogger.info('Fetching repository', {
        userId: this.user.id,
        owner,
        repo
      });

      const response = await this.githubService.getRepository(owner, repo);

      if (!response.success) {
        return {
          success: false,
          error: response.error || 'Unknown error'
        };
      }

      return {
        success: true,
        data: response.data!,
        ...(response.rateLimit && { rateLimit: response.rateLimit })
      };

    } catch (error: any) {
      githubApiLogger.error('Failed to fetch repository', {
        userId: this.user.id,
        owner,
        repo,
        error: error.message
      });

      return {
        success: false,
        error: 'Failed to fetch repository'
      };
    }
  }

  /**
   * Get current rate limit status
   */
  async getRateLimit(): Promise<ApiResponse<any>> {
    try {
      const response = await this.githubService.getRateLimit();
      return response;
    } catch (error: any) {
      githubApiLogger.error('Failed to fetch rate limit', {
        userId: this.user.id,
        error: error.message
      });

      return {
        success: false,
        error: 'Failed to fetch rate limit status'
      };
    }
  }

  /**
   * Validate repository access
   */
  async validateRepositoryAccess(owner: string, repo: string): Promise<{
    hasAccess: boolean;
    canClone: boolean;
    error?: string;
  }> {
    try {
      const response = await this.getRepository(owner, repo);
      
      if (!response.success) {
        return {
          hasAccess: false,
          canClone: false,
          error: response.error || 'Unknown error'
        };
      }

      const repository = response.data!;
      
      return {
        hasAccess: true,
        canClone: repository.permissions.pull || !repository.private
      };

    } catch (error: any) {
      return {
        hasAccess: false,
        canClone: false,
        error: 'Failed to validate repository access'
      };
    }
  }
}

/**
 * Create GitHub API service instance for authenticated user
 */
export function createGitHubApiService(user: AuthenticatedUser): GitHubApiService {
  return new GitHubApiService(user);
}
