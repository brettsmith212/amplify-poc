/**
 * GitHub API client and token management
 */

import { Octokit } from '@octokit/rest';
import { AuthenticatedUser, GitHubRepository, GitHubBranch } from '../models/User';
import { logger } from '../utils/logger';

const githubLogger = logger.child('GitHubService');

export interface GitHubApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  rateLimit?: {
    limit: number;
    remaining: number;
    reset: Date;
  };
}

export class GitHubService {
  private octokit: Octokit;
  private user: AuthenticatedUser;

  constructor(user: AuthenticatedUser) {
    this.user = user;
    this.octokit = new Octokit({
      auth: user.accessToken,
      userAgent: 'Amplify-Web/1.0.0',
      timeZone: 'UTC'
    });
  }

  /**
   * Get user's repositories
   */
  async getRepositories(options: {
    type?: 'all' | 'owner' | 'member';
    sort?: 'created' | 'updated' | 'pushed' | 'full_name';
    direction?: 'asc' | 'desc';
    per_page?: number;
    page?: number;
  } = {}): Promise<GitHubApiResponse<GitHubRepository[]>> {
    try {
      githubLogger.debug('Fetching repositories', {
        userId: this.user.id,
        options
      });

      const response = await this.octokit.repos.listForAuthenticatedUser({
        type: options.type || 'all',
        sort: options.sort || 'updated',
        direction: options.direction || 'desc',
        per_page: options.per_page || 30,
        page: options.page || 1
      });

      const repositories: GitHubRepository[] = response.data.map(repo => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description || undefined,
        private: repo.private,
        htmlUrl: repo.html_url,
        cloneUrl: repo.clone_url,
        defaultBranch: repo.default_branch,
        language: repo.language || undefined,
        stargazersCount: repo.stargazers_count,
        forksCount: repo.forks_count,
        updatedAt: new Date(repo.updated_at || Date.now()),
        permissions: {
          admin: repo.permissions?.admin || false,
          push: repo.permissions?.push || false,
          pull: repo.permissions?.pull || false
        },
        owner: {
          login: repo.owner.login,
          avatarUrl: repo.owner.avatar_url
        }
      }));

      const rateLimit = this.extractRateLimit(response.headers);

      githubLogger.info('Repositories fetched successfully', {
        userId: this.user.id,
        count: repositories.length,
        rateLimit
      });

      return {
        success: true,
        data: repositories,
        rateLimit
      };

    } catch (error: any) {
      githubLogger.error('Failed to fetch repositories', {
        userId: this.user.id,
        error: error.message,
        status: error.status
      });

      return {
        success: false,
        error: this.formatApiError(error)
      };
    }
  }

  /**
   * Get branches for a repository
   */
  async getBranches(
    owner: string, 
    repo: string, 
    options: {
      per_page?: number;
      page?: number;
    } = {}
  ): Promise<GitHubApiResponse<GitHubBranch[]>> {
    try {
      githubLogger.debug('Fetching branches', {
        userId: this.user.id,
        owner,
        repo,
        options
      });

      const response = await this.octokit.repos.listBranches({
        owner,
        repo,
        per_page: options.per_page || 30,
        page: options.page || 1
      });

      const branches: GitHubBranch[] = response.data.map(branch => ({
        name: branch.name,
        commit: {
          sha: branch.commit.sha,
          url: branch.commit.url
        },
        protected: branch.protected
      }));

      const rateLimit = this.extractRateLimit(response.headers);

      githubLogger.info('Branches fetched successfully', {
        userId: this.user.id,
        owner,
        repo,
        count: branches.length,
        rateLimit
      });

      return {
        success: true,
        data: branches,
        rateLimit
      };

    } catch (error: any) {
      githubLogger.error('Failed to fetch branches', {
        userId: this.user.id,
        owner,
        repo,
        error: error.message,
        status: error.status
      });

      return {
        success: false,
        error: this.formatApiError(error)
      };
    }
  }

  /**
   * Get a specific repository
   */
  async getRepository(owner: string, repo: string): Promise<GitHubApiResponse<GitHubRepository>> {
    try {
      githubLogger.debug('Fetching repository', {
        userId: this.user.id,
        owner,
        repo
      });

      const response = await this.octokit.repos.get({
        owner,
        repo
      });

      const repository: GitHubRepository = {
        id: response.data.id,
        name: response.data.name,
        fullName: response.data.full_name,
        description: response.data.description || undefined,
        private: response.data.private,
        htmlUrl: response.data.html_url,
        cloneUrl: response.data.clone_url,
        defaultBranch: response.data.default_branch,
        language: response.data.language || undefined,
        stargazersCount: response.data.stargazers_count,
        forksCount: response.data.forks_count,
        updatedAt: new Date(response.data.updated_at || Date.now()),
        permissions: {
          admin: response.data.permissions?.admin || false,
          push: response.data.permissions?.push || false,
          pull: response.data.permissions?.pull || false
        },
        owner: {
          login: response.data.owner?.login || '',
          avatarUrl: response.data.owner?.avatar_url || ''
        }
      };

      const rateLimit = this.extractRateLimit(response.headers);

      githubLogger.info('Repository fetched successfully', {
        userId: this.user.id,
        owner,
        repo,
        rateLimit
      });

      return {
        success: true,
        data: repository,
        rateLimit
      };

    } catch (error: any) {
      githubLogger.error('Failed to fetch repository', {
        userId: this.user.id,
        owner,
        repo,
        error: error.message,
        status: error.status
      });

      return {
        success: false,
        error: this.formatApiError(error)
      };
    }
  }

  /**
   * Search repositories
   */
  async searchRepositories(
    query: string,
    options: {
      sort?: 'stars' | 'forks' | 'help-wanted-issues' | 'updated';
      order?: 'asc' | 'desc';
      per_page?: number;
      page?: number;
    } = {}
  ): Promise<GitHubApiResponse<GitHubRepository[]>> {
    try {
      githubLogger.debug('Searching repositories', {
        userId: this.user.id,
        query,
        options
      });

      const searchParams: any = {
        q: query,
        per_page: options.per_page || 30,
        page: options.page || 1
      };
      
      if (options.sort) {
        searchParams.sort = options.sort;
      }
      
      if (options.order) {
        searchParams.order = options.order;
      }

      const response = await this.octokit.search.repos(searchParams);

      const repositories: GitHubRepository[] = response.data.items.map(repo => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description || undefined,
        private: repo.private,
        htmlUrl: repo.html_url,
        cloneUrl: repo.clone_url,
        defaultBranch: repo.default_branch,
        language: repo.language || undefined,
        stargazersCount: repo.stargazers_count,
        forksCount: repo.forks_count,
        updatedAt: new Date(repo.updated_at || Date.now()),
        permissions: {
          admin: false, // Search results don't include permissions
          push: false,
          pull: true
        },
        owner: {
          login: repo.owner?.login || '',
          avatarUrl: repo.owner?.avatar_url || ''
        }
      }));

      const rateLimit = this.extractRateLimit(response.headers);

      githubLogger.info('Repository search completed', {
        userId: this.user.id,
        query,
        count: repositories.length,
        totalCount: response.data.total_count,
        rateLimit
      });

      return {
        success: true,
        data: repositories,
        rateLimit
      };

    } catch (error: any) {
      githubLogger.error('Failed to search repositories', {
        userId: this.user.id,
        query,
        error: error.message,
        status: error.status
      });

      return {
        success: false,
        error: this.formatApiError(error)
      };
    }
  }

  /**
   * Get current rate limit status
   */
  async getRateLimit(): Promise<GitHubApiResponse<any>> {
    try {
      const response = await this.octokit.rateLimit.get();
      
      return {
        success: true,
        data: response.data,
        rateLimit: {
          limit: response.data.rate.limit,
          remaining: response.data.rate.remaining,
          reset: new Date(response.data.rate.reset * 1000)
        }
      };

    } catch (error: any) {
      return {
        success: false,
        error: this.formatApiError(error)
      };
    }
  }

  /**
   * Extract rate limit information from response headers
   */
  private extractRateLimit(headers: any): {
    limit: number;
    remaining: number;
    reset: Date;
  } {
    return {
      limit: parseInt(headers['x-ratelimit-limit'] || '5000', 10),
      remaining: parseInt(headers['x-ratelimit-remaining'] || '5000', 10),
      reset: new Date(parseInt(headers['x-ratelimit-reset'] || '0', 10) * 1000)
    };
  }

  /**
   * Format API error message
   */
  private formatApiError(error: any): string {
    if (error.status === 401) {
      return 'GitHub authentication failed. Please log in again.';
    }
    
    if (error.status === 403) {
      if (error.message.includes('rate limit')) {
        return 'GitHub API rate limit exceeded. Please try again later.';
      }
      return 'Access forbidden. Check repository permissions.';
    }
    
    if (error.status === 404) {
      return 'Repository not found or access denied.';
    }
    
    return error.message || 'An unknown error occurred';
  }
}

/**
 * Create GitHub service instance for authenticated user
 */
export function createGitHubService(user: AuthenticatedUser): GitHubService {
  return new GitHubService(user);
}
