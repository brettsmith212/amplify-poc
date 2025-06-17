/**
 * Diff routes for Monaco diff viewer support
 */

import { Router, Request, Response } from 'express';
import { getAuthenticatedUser } from '../middleware/auth';
import { sessionStore } from '../services/sessionStore';
import { gitOperationsService } from '../services/gitOperations';
import { logger } from '../utils/logger';

const router = Router();
const diffRoutesLogger = logger.child('DiffRoutes');

/**
 * Get structured diff data for Monaco editor
 */
router.get('/:sessionId/diff', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = getAuthenticatedUser(req)!;
    const { sessionId } = req.params;

    diffRoutesLogger.info('Getting structured diff data', {
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

    // Get raw git diff
    const diffResult = await gitOperationsService.getDiff(sessionId!);
    
    if (!diffResult.success) {
      res.json({
        success: true,
        data: {
          sessionId,
          repositoryName: session.repositoryUrl.split('/').pop()?.replace('.git', '') || 'unknown',
          branch: session.branch || 'main',
          rawDiff: '',
          hasChanges: false
        }
      });
      return;
    }

    // Simple approach: just clean and return the raw diff text
    const rawDiff = (diffResult as any).diff || '';
    const cleanedDiff = rawDiff
      // Remove binary headers and control chars but keep newlines
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\xFF]/g, '')
      // Normalize line endings
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();

    const diffData = {
      sessionId,
      repositoryName: session.repositoryUrl.split('/').pop()?.replace('.git', '') || 'unknown',
      branch: session.branch || 'main',
      rawDiff: cleanedDiff,
      hasChanges: cleanedDiff.length > 0
    };

    diffRoutesLogger.info('Successfully retrieved diff data', {
      userId: user.id,
      sessionId,
      hasChanges: diffData.hasChanges
    });

    res.json({
      success: true,
      data: diffData
    });

  } catch (error: any) {
    diffRoutesLogger.error('Failed to get diff data', {
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
