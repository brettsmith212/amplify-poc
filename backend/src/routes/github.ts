/**
 * GitHub API proxy routes for repositories and branches
 */

import { Router, Request, Response } from 'express';
import { 
  authenticateUser, 
  requireAuth, 
  getAuthenticatedUser 
} from '../middleware/auth';
import { githubApiRateLimit } from '../middleware/rateLimit';
import { 
  createGitHubApiService,
  RepositoryFilters,
  PaginationOptions 
} from '../services/githubApi';
import { logger } from '../utils/logger';

const githubRoutesLogger = logger.child('GitHubRoutes');
const router = Router();

// Apply authentication and rate limiting to all routes
router.use(authenticateUser);
router.use(requireAuth);
router.use(githubApiRateLimit.middleware);

/**
 * GET /api/github/repos
 * Get user's repositories with optional filtering and pagination
 */
router.get('/repos', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = getAuthenticatedUser(req)!;
    const githubApi = createGitHubApiService(user);

    // Parse query parameters
    const filters: RepositoryFilters = {
      type: (req.query.type as 'all' | 'owner' | 'member') || 'all',
      sort: (req.query.sort as 'created' | 'updated' | 'pushed' | 'full_name') || 'updated',
      direction: (req.query.direction as 'asc' | 'desc') || 'desc'
    };

    // Only add search if it's provided
    if (req.query.search) {
      filters.search = req.query.search as string;
    }

    const pagination: PaginationOptions = {
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      per_page: Math.min(
        req.query.per_page ? parseInt(req.query.per_page as string, 10) : 30,
        100 // Maximum per page
      )
    };

    // Validate pagination parameters
    if (pagination.page! < 1) {
      res.status(400).json({
        error: 'Invalid pagination',
        message: 'Page number must be greater than 0'
      });
      return;
    }

    if (pagination.per_page! < 1 || pagination.per_page! > 100) {
      res.status(400).json({
        error: 'Invalid pagination',
        message: 'Per page must be between 1 and 100'
      });
      return;
    }

    githubRoutesLogger.info('Fetching repositories', {
      userId: user.id,
      filters,
      pagination
    });

    const result = await githubApi.getRepositories(filters, pagination);

    if (!result.success) {
      githubRoutesLogger.error('Failed to fetch repositories', {
        userId: user.id,
        error: result.error,
        filters,
        pagination
      });

      res.status(500).json({
        error: 'Failed to fetch repositories',
        message: result.error
      });
      return;
    }

    // Set rate limit headers if available
    if (result.rateLimit) {
      res.set({
        'X-GitHub-RateLimit-Limit': result.rateLimit.limit.toString(),
        'X-GitHub-RateLimit-Remaining': result.rateLimit.remaining.toString(),
        'X-GitHub-RateLimit-Reset': Math.ceil(result.rateLimit.reset.getTime() / 1000).toString()
      });
    }

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      meta: {
        total: result.data?.length || 0,
        filters,
        pagination: result.pagination
      }
    });

  } catch (error: any) {
    githubRoutesLogger.error('Error in /repos endpoint', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch repositories'
    });
  }
});

/**
 * GET /api/github/repos/:owner/:repo
 * Get a specific repository
 */
router.get('/repos/:owner/:repo', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = getAuthenticatedUser(req)!;
    const githubApi = createGitHubApiService(user);
    const { owner, repo } = req.params;

    if (!owner || !repo) {
      res.status(400).json({
        error: 'Invalid parameters',
        message: 'Owner and repository name are required'
      });
      return;
    }

    githubRoutesLogger.info('Fetching repository', {
      userId: user.id,
      owner,
      repo
    });

    const result = await githubApi.getRepository(owner, repo);

    if (!result.success) {
      const statusCode = result.error?.includes('not found') ? 404 : 500;
      
      githubRoutesLogger.error('Failed to fetch repository', {
        userId: user.id,
        owner,
        repo,
        error: result.error,
        statusCode
      });

      res.status(statusCode).json({
        error: 'Failed to fetch repository',
        message: result.error
      });
      return;
    }

    // Set rate limit headers if available
    if (result.rateLimit) {
      res.set({
        'X-GitHub-RateLimit-Limit': result.rateLimit.limit.toString(),
        'X-GitHub-RateLimit-Remaining': result.rateLimit.remaining.toString(),
        'X-GitHub-RateLimit-Reset': Math.ceil(result.rateLimit.reset.getTime() / 1000).toString()
      });
    }

    res.json({
      success: true,
      data: result.data
    });

  } catch (error: any) {
    githubRoutesLogger.error('Error in /repos/:owner/:repo endpoint', {
      error: error.message,
      stack: error.stack,
      params: req.params
    });

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch repository'
    });
  }
});

/**
 * GET /api/github/repos/:owner/:repo/branches
 * Get branches for a repository
 */
router.get('/repos/:owner/:repo/branches', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = getAuthenticatedUser(req)!;
    const githubApi = createGitHubApiService(user);
    const { owner, repo } = req.params;

    if (!owner || !repo) {
      res.status(400).json({
        error: 'Invalid parameters',
        message: 'Owner and repository name are required'
      });
      return;
    }

    const pagination: PaginationOptions = {
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      per_page: Math.min(
        req.query.per_page ? parseInt(req.query.per_page as string, 10) : 30,
        100 // Maximum per page
      )
    };

    // Validate pagination parameters
    if (pagination.page! < 1) {
      res.status(400).json({
        error: 'Invalid pagination',
        message: 'Page number must be greater than 0'
      });
      return;
    }

    if (pagination.per_page! < 1 || pagination.per_page! > 100) {
      res.status(400).json({
        error: 'Invalid pagination',
        message: 'Per page must be between 1 and 100'
      });
      return;
    }

    githubRoutesLogger.info('Fetching branches', {
      userId: user.id,
      owner,
      repo,
      pagination
    });

    const result = await githubApi.getBranches(owner, repo, pagination);

    if (!result.success) {
      const statusCode = result.error?.includes('not found') ? 404 : 500;
      
      githubRoutesLogger.error('Failed to fetch branches', {
        userId: user.id,
        owner,
        repo,
        error: result.error,
        statusCode
      });

      res.status(statusCode).json({
        error: 'Failed to fetch branches',
        message: result.error
      });
      return;
    }

    // Set rate limit headers if available
    if (result.rateLimit) {
      res.set({
        'X-GitHub-RateLimit-Limit': result.rateLimit.limit.toString(),
        'X-GitHub-RateLimit-Remaining': result.rateLimit.remaining.toString(),
        'X-GitHub-RateLimit-Reset': Math.ceil(result.rateLimit.reset.getTime() / 1000).toString()
      });
    }

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      meta: {
        total: result.data?.length || 0,
        repository: `${owner}/${repo}`,
        pagination: result.pagination
      }
    });

  } catch (error: any) {
    githubRoutesLogger.error('Error in /branches endpoint', {
      error: error.message,
      stack: error.stack,
      params: req.params
    });

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch branches'
    });
  }
});

/**
 * GET /api/github/repos/:owner/:repo/access
 * Validate repository access and permissions
 */
router.get('/repos/:owner/:repo/access', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = getAuthenticatedUser(req)!;
    const githubApi = createGitHubApiService(user);
    const { owner, repo } = req.params;

    if (!owner || !repo) {
      res.status(400).json({
        error: 'Invalid parameters',
        message: 'Owner and repository name are required'
      });
      return;
    }

    githubRoutesLogger.info('Validating repository access', {
      userId: user.id,
      owner,
      repo
    });

    const accessResult = await githubApi.validateRepositoryAccess(owner, repo);

    if (accessResult.error) {
      githubRoutesLogger.warn('Repository access validation failed', {
        userId: user.id,
        owner,
        repo,
        error: accessResult.error
      });

      res.status(403).json({
        error: 'Access validation failed',
        message: accessResult.error,
        access: {
          hasAccess: false,
          canClone: false
        }
      });
      return;
    }

    res.json({
      success: true,
      access: {
        hasAccess: accessResult.hasAccess,
        canClone: accessResult.canClone,
        repository: `${owner}/${repo}`
      }
    });

  } catch (error: any) {
    githubRoutesLogger.error('Error in /access endpoint', {
      error: error.message,
      stack: error.stack,
      params: req.params
    });

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to validate repository access'
    });
  }
});

/**
 * GET /api/github/rate-limit
 * Get current GitHub API rate limit status
 */
router.get('/rate-limit', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = getAuthenticatedUser(req)!;
    const githubApi = createGitHubApiService(user);

    githubRoutesLogger.debug('Fetching rate limit status', {
      userId: user.id
    });

    const result = await githubApi.getRateLimit();

    if (!result.success) {
      res.status(500).json({
        error: 'Failed to fetch rate limit',
        message: result.error
      });
      return;
    }

    res.json({
      success: true,
      data: result.data,
      rateLimit: result.rateLimit
    });

  } catch (error: any) {
    githubRoutesLogger.error('Error in /rate-limit endpoint', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch rate limit status'
    });
  }
});

export default router;
