/**
 * Git operation routes for commit and push functionality
 */

import { Router, Request, Response } from 'express';
import { getAuthenticatedUser } from '../middleware/auth';
import { gitOperationsService } from '../services/gitOperations';
import { sessionStore } from '../services/sessionStore';
import { logger } from '../utils/logger';

const router = Router();
const gitRoutesLogger = logger.child('GitRoutes');

/**
 * Get git status for a session
 */
router.get('/:sessionId/git/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = getAuthenticatedUser(req)!;
    const { sessionId } = req.params;

    gitRoutesLogger.info('Getting git status', {
      userId: user.id,
      sessionId
    });

    // Validate session ownership
    const session = sessionStore.getSession(sessionId!);
    if (!session || session.userId !== user.id) {
      res.status(404).json({
        success: false,
        error: 'Session not found'
      });
      return;
    }

    const result = await gitOperationsService.getStatus(sessionId!);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: {
          status: result.message
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to get git status'
      });
    }

  } catch (error: any) {
    gitRoutesLogger.error('Failed to get git status', {
      sessionId: req.params.sessionId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get git diff for a session
 */
router.get('/:sessionId/git/diff', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = getAuthenticatedUser(req)!;
    const { sessionId } = req.params;

    gitRoutesLogger.info('Getting git diff', {
      userId: user.id,
      sessionId
    });

    // Validate session ownership
    const session = sessionStore.getSession(sessionId!);
    if (!session || session.userId !== user.id) {
      res.status(404).json({
        success: false,
        error: 'Session not found'
      });
      return;
    }

    const result = await gitOperationsService.getDiff(sessionId!);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: {
          diff: (result as any).diff
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to get git diff'
      });
    }

  } catch (error: any) {
    gitRoutesLogger.error('Failed to get git diff', {
      sessionId: req.params.sessionId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Commit changes in a session
 */
router.post('/:sessionId/git/commit', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = getAuthenticatedUser(req)!;
    const { sessionId } = req.params;
    const { message, description, files } = req.body;

    // Validate required fields
    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({
        success: false,
        error: 'Commit message is required'
      });
      return;
    }

    gitRoutesLogger.info('Committing changes', {
      userId: user.id,
      sessionId,
      message,
      hasDescription: !!description,
      fileCount: files?.length
    });

    // Validate session ownership
    const session = sessionStore.getSession(sessionId!);
    if (!session || session.userId !== user.id) {
      res.status(404).json({
        success: false,
        error: 'Session not found'
      });
      return;
    }

    const result = await gitOperationsService.commit(sessionId!, {
      message: message.trim(),
      description: description?.trim(),
      files,
      author: {
        name: user.username,
        email: user.email || `${user.username}@users.noreply.github.com`
      }
    });

    if (result.success) {
      gitRoutesLogger.info('Changes committed successfully', {
        userId: user.id,
        sessionId,
        commitHash: result.commitHash
      });

      res.json({
        success: true,
        message: result.message,
        data: {
          commitHash: result.commitHash
        }
      });
    } else {
      gitRoutesLogger.warn('Failed to commit changes', {
        userId: user.id,
        sessionId,
        error: result.error
      });

      res.status(500).json({
        success: false,
        error: result.error || 'Failed to commit changes'
      });
    }

  } catch (error: any) {
    gitRoutesLogger.error('Failed to commit changes', {
      sessionId: req.params.sessionId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Push changes to remote repository
 */
router.post('/:sessionId/git/push', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = getAuthenticatedUser(req)!;
    const { sessionId } = req.params;
    const { force, createPullRequest, pullRequestTitle, pullRequestDescription } = req.body;

    gitRoutesLogger.info('Pushing changes', {
      userId: user.id,
      sessionId,
      force: !!force,
      createPR: !!createPullRequest
    });

    // Validate session ownership
    const session = sessionStore.getSession(sessionId!);
    if (!session || session.userId !== user.id) {
      res.status(404).json({
        success: false,
        error: 'Session not found'
      });
      return;
    }

    const result = await gitOperationsService.push(sessionId!, {
      force: !!force,
      createPullRequest: !!createPullRequest,
      pullRequestTitle,
      pullRequestDescription
    });

    if (result.success) {
      gitRoutesLogger.info('Changes pushed successfully', {
        userId: user.id,
        sessionId,
        pullRequestUrl: result.pullRequestUrl
      });

      res.json({
        success: true,
        message: result.message,
        data: {
          pullRequestUrl: result.pullRequestUrl
        }
      });
    } else {
      gitRoutesLogger.warn('Failed to push changes', {
        userId: user.id,
        sessionId,
        error: result.error
      });

      res.status(500).json({
        success: false,
        error: result.error || 'Failed to push changes'
      });
    }

  } catch (error: any) {
    gitRoutesLogger.error('Failed to push changes', {
      sessionId: req.params.sessionId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get commit log for a session
 */
router.get('/:sessionId/git/log', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = getAuthenticatedUser(req)!;
    const { sessionId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    gitRoutesLogger.info('Getting commit log', {
      userId: user.id,
      sessionId,
      limit
    });

    // Validate session ownership
    const session = sessionStore.getSession(sessionId!);
    if (!session || session.userId !== user.id) {
      res.status(404).json({
        success: false,
        error: 'Session not found'
      });
      return;
    }

    const result = await gitOperationsService.getLog(sessionId!, limit);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: {
          commits: (result as any).commits || []
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to get commit log'
      });
    }

  } catch (error: any) {
    gitRoutesLogger.error('Failed to get commit log', {
      sessionId: req.params.sessionId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
