/**
 * Tests for GitHub API integration
 */

import request from 'supertest';
import { Express } from 'express';
import { AuthenticatedUser, TerminalTheme, EditorTheme } from '../models/User';
import { GitHubApiService } from '../services/githubApi';
import { createGitHubApiService } from '../services/githubApi';

// Mock the GitHub service
jest.mock('../services/github', () => ({
  createGitHubService: jest.fn(),
  GitHubService: jest.fn().mockImplementation(() => ({
    getRepositories: jest.fn(),
    getBranches: jest.fn(),
    getRepository: jest.fn(),
    getRateLimit: jest.fn(),
    searchRepositories: jest.fn()
  }))
}));

// Mock the logger
jest.mock('../utils/logger', () => ({
  logger: {
    child: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn()
    }))
  }
}));

describe('GitHub API Integration', () => {
  let app: Express;
  let mockUser: AuthenticatedUser;
  let mockGitHubService: any;

  beforeEach(() => {
    // Create mock authenticated user
    mockUser = {
      isAuthenticated: true,
      id: 'test-user-123',
      githubId: 12345,
      username: 'testuser',
      email: 'test@example.com',
      name: 'Test User',
      avatarUrl: 'https://github.com/avatars/test.png',
      accessToken: 'mock-access-token',
      scopes: ['repo', 'user:email'],
      createdAt: new Date(),
      lastLoginAt: new Date(),
      profile: {
        bio: '',
        company: '',
        location: '',
        blog: '',
        twitterUsername: '',
        publicRepos: 10,
        privateRepos: 5,
        followers: 100,
        following: 50
      },
      preferences: {
        terminalTheme: TerminalTheme.DARK,
        editorTheme: EditorTheme.VS_DARK,
        sessionTimeout: 240,
        autoSaveInterval: 30,
        notifications: {
          sessionExpiry: true,
          containerErrors: true,
          gitOperations: true,
          email: false
        }
      }
    };

    // Mock GitHub service methods
    mockGitHubService = {
      getRepositories: jest.fn(),
      getBranches: jest.fn(),
      getRepository: jest.fn(),
      getRateLimit: jest.fn(),
      searchRepositories: jest.fn()
    };

    const { createGitHubService } = require('../services/github');
    createGitHubService.mockReturnValue(mockGitHubService);

    // Create test app with routes
    const express = require('express');
    app = express();
    app.use(express.json());

    // Mock authentication middleware
    app.use((req: any, res: any, next: any) => {
      req.user = mockUser;
      next();
    });

    // Add GitHub routes
    const githubRoutes = require('../routes/github').default;
    app.use('/api/github', githubRoutes);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GitHubApiService', () => {
    let service: GitHubApiService;

    beforeEach(() => {
      service = createGitHubApiService(mockUser);
    });

    describe('getRepositories', () => {
      it('should return repositories successfully', async () => {
        const mockRepos = [
          {
            id: 1,
            name: 'test-repo',
            fullName: 'testuser/test-repo',
            description: 'A test repository',
            private: false,
            htmlUrl: 'https://github.com/testuser/test-repo',
            cloneUrl: 'https://github.com/testuser/test-repo.git',
            defaultBranch: 'main',
            language: 'TypeScript',
            stargazersCount: 10,
            forksCount: 2,
            updatedAt: new Date(),
            permissions: {
              admin: true,
              push: true,
              pull: true
            }
          }
        ];

        mockGitHubService.getRepositories.mockResolvedValue({
          success: true,
          data: mockRepos,
          rateLimit: { limit: 5000, remaining: 4999, reset: new Date() }
        });

        const result = await service.getRepositories();

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockRepos);
        expect(result.rateLimit).toBeDefined();
        expect(result.pagination).toBeDefined();
      });

      it('should handle search queries', async () => {
        const searchQuery = 'test';
        mockGitHubService.searchRepositories.mockResolvedValue({
          success: true,
          data: [],
          rateLimit: { limit: 5000, remaining: 4998, reset: new Date() }
        });

        const result = await service.getRepositories({ search: searchQuery });

        expect(mockGitHubService.searchRepositories).toHaveBeenCalledWith(
          `${searchQuery} user:${mockUser.username}`,
          expect.any(Object)
        );
        expect(result.success).toBe(true);
      });

      it('should handle errors gracefully', async () => {
        mockGitHubService.getRepositories.mockResolvedValue({
          success: false,
          error: 'API error'
        });

        const result = await service.getRepositories();

        expect(result.success).toBe(false);
        expect(result.error).toBe('API error');
      });
    });

    describe('getBranches', () => {
      it('should return branches successfully', async () => {
        const mockBranches = [
          {
            name: 'main',
            commit: { sha: 'abc123', url: 'https://api.github.com/commits/abc123' },
            protected: false
          },
          {
            name: 'develop',
            commit: { sha: 'def456', url: 'https://api.github.com/commits/def456' },
            protected: true
          }
        ];

        mockGitHubService.getBranches.mockResolvedValue({
          success: true,
          data: mockBranches,
          rateLimit: { limit: 5000, remaining: 4997, reset: new Date() }
        });

        const result = await service.getBranches('testuser', 'test-repo');

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockBranches);
        expect(result.rateLimit).toBeDefined();
        expect(result.pagination).toBeDefined();
      });

      it('should handle errors gracefully', async () => {
        mockGitHubService.getBranches.mockResolvedValue({
          success: false,
          error: 'Repository not found'
        });

        const result = await service.getBranches('testuser', 'nonexistent-repo');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Repository not found');
      });
    });

    describe('validateRepositoryAccess', () => {
      it('should validate access for public repository', async () => {
        const mockRepo = {
          id: 1,
          name: 'test-repo',
          fullName: 'testuser/test-repo',
          private: false,
          permissions: {
            admin: false,
            push: false,
            pull: true
          }
        };

        mockGitHubService.getRepository.mockResolvedValue({
          success: true,
          data: mockRepo
        });

        const result = await service.validateRepositoryAccess('testuser', 'test-repo');

        expect(result.hasAccess).toBe(true);
        expect(result.canClone).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should validate access for private repository with permissions', async () => {
        const mockRepo = {
          id: 1,
          name: 'private-repo',
          fullName: 'testuser/private-repo',
          private: true,
          permissions: {
            admin: true,
            push: true,
            pull: true
          }
        };

        mockGitHubService.getRepository.mockResolvedValue({
          success: true,
          data: mockRepo
        });

        const result = await service.validateRepositoryAccess('testuser', 'private-repo');

        expect(result.hasAccess).toBe(true);
        expect(result.canClone).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should handle access denied', async () => {
        mockGitHubService.getRepository.mockResolvedValue({
          success: false,
          error: 'Repository not found or access denied'
        });

        const result = await service.validateRepositoryAccess('otheruser', 'private-repo');

        expect(result.hasAccess).toBe(false);
        expect(result.canClone).toBe(false);
        expect(result.error).toBe('Repository not found or access denied');
      });
    });
  });

  describe('GitHub API Routes', () => {
    describe('GET /api/github/repos', () => {
      it('should return repositories with default parameters', async () => {
        mockGitHubService.getRepositories.mockResolvedValue({
          success: true,
          data: [],
          rateLimit: { limit: 5000, remaining: 4999, reset: new Date() }
        });

        const response = await request(app)
          .get('/api/github/repos')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual([]);
        expect(response.body.pagination).toBeDefined();
        expect(response.body.meta).toBeDefined();
      });

      it('should handle query parameters', async () => {
        mockGitHubService.getRepositories.mockResolvedValue({
          success: true,
          data: [],
          rateLimit: { limit: 5000, remaining: 4999, reset: new Date() }
        });

        await request(app)
          .get('/api/github/repos?type=owner&sort=created&direction=asc&page=2&per_page=10')
          .expect(200);

        expect(mockGitHubService.getRepositories).toHaveBeenCalledWith({
          type: 'owner',
          sort: 'created',
          direction: 'asc',
          per_page: 10,
          page: 2
        });
      });

      it('should handle search queries', async () => {
        mockGitHubService.searchRepositories.mockResolvedValue({
          success: true,
          data: [],
          rateLimit: { limit: 5000, remaining: 4999, reset: new Date() }
        });

        await request(app)
          .get('/api/github/repos?search=test')
          .expect(200);

        expect(mockGitHubService.searchRepositories).toHaveBeenCalled();
      });

      it('should validate pagination parameters', async () => {
        const response = await request(app)
          .get('/api/github/repos?page=0')
          .expect(400);

        expect(response.body.error).toBe('Invalid pagination');
      });

      it('should handle service errors', async () => {
        mockGitHubService.getRepositories.mockResolvedValue({
          success: false,
          error: 'GitHub API error'
        });

        const response = await request(app)
          .get('/api/github/repos')
          .expect(500);

        expect(response.body.error).toBe('Failed to fetch repositories');
      });
    });

    describe('GET /api/github/repos/:owner/:repo/branches', () => {
      it('should return branches for a repository', async () => {
        const mockBranches = [
          { name: 'main', commit: { sha: 'abc123', url: 'test' }, protected: false }
        ];

        mockGitHubService.getBranches.mockResolvedValue({
          success: true,
          data: mockBranches,
          rateLimit: { limit: 5000, remaining: 4999, reset: new Date() }
        });

        const response = await request(app)
          .get('/api/github/repos/testuser/test-repo/branches')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockBranches);
        expect(response.body.meta.repository).toBe('testuser/test-repo');
      });

      it('should validate required parameters', async () => {
        // Test with missing repo parameter - this should hit the 404 for the route
        const response = await request(app)
          .get('/api/github/repos/testuser/')
          .expect(404);

        // The route doesn't exist, so we get a 404 which is expected behavior
        expect(response.status).toBe(404);
      });

      it('should handle repository not found', async () => {
        mockGitHubService.getBranches.mockResolvedValue({
          success: false,
          error: 'Repository not found'
        });

        const response = await request(app)
          .get('/api/github/repos/testuser/nonexistent/branches')
          .expect(404);

        expect(response.body.error).toBe('Failed to fetch branches');
      });
    });

    describe('GET /api/github/repos/:owner/:repo/access', () => {
      it('should validate repository access', async () => {
        mockGitHubService.getRepository.mockResolvedValue({
          success: true,
          data: {
            private: false,
            permissions: { admin: false, push: false, pull: true }
          }
        });

        const response = await request(app)
          .get('/api/github/repos/testuser/test-repo/access')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.access.hasAccess).toBe(true);
        expect(response.body.access.canClone).toBe(true);
      });

      it('should handle access denied', async () => {
        mockGitHubService.getRepository.mockResolvedValue({
          success: false,
          error: 'Repository not found or access denied'
        });

        const response = await request(app)
          .get('/api/github/repos/otheruser/private-repo/access')
          .expect(403);

        expect(response.body.access.hasAccess).toBe(false);
      });
    });

    describe('GET /api/github/rate-limit', () => {
      it('should return rate limit status', async () => {
        const mockRateLimit = {
          rate: { limit: 5000, remaining: 4999, reset: 1234567890 }
        };

        mockGitHubService.getRateLimit.mockResolvedValue({
          success: true,
          data: mockRateLimit,
          rateLimit: { limit: 5000, remaining: 4999, reset: new Date() }
        });

        const response = await request(app)
          .get('/api/github/rate-limit')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockRateLimit);
        expect(response.body.rateLimit).toBeDefined();
      });

      it('should handle rate limit fetch errors', async () => {
        mockGitHubService.getRateLimit.mockResolvedValue({
          success: false,
          error: 'Failed to fetch rate limit'
        });

        const response = await request(app)
          .get('/api/github/rate-limit')
          .expect(500);

        expect(response.body.error).toBe('Failed to fetch rate limit');
      });
    });
  });
});
