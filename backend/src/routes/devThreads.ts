import { Router, Request, Response } from 'express';
import { sessionStore } from '../services/sessionStore';
import { ampService } from '../services/ampService';
import { logger } from '../utils/logger';
import { Session, SessionStatus } from '../models/Session';
import {
  getThreadMessages,
  getLatestThreadMessages,
  getThreadStats,
  clearThreadMessages,
  GetThreadMessagesRequest
} from '../controllers/threadController';

const router = Router();
const devLogger = logger.child('DevThreadRoutes');

// Disable rate limiting for development routes
router.use((req, res, next) => {
  // Skip rate limiting in development
  next();
});

/**
 * Development-only route to create a session with thread without authentication
 * POST /api/dev/thread/create
 */
router.post('/create', async (req: Request, res: Response): Promise<void> => {
  try {
    if (process.env.NODE_ENV === 'production') {
      res.status(403).json({ error: 'Development routes not available in production' });
      return;
    }

    devLogger.info('Creating development thread session');

    // Create a development session
    const sessionId = `dev-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create amp thread
    const threadResult = await ampService.createThread(sessionId, {
      environment: {
        REPOSITORY_URL: 'https://github.com/example/repo',
        REPOSITORY_BRANCH: 'main',
        USER_ID: 'dev-user'
      }
    });

    if (!threadResult.success) {
      devLogger.error('Failed to create amp thread for dev session', {
        sessionId,
        error: threadResult.error
      });

      res.status(500).json({
        error: 'Failed to create thread',
        message: threadResult.error
      });
      return;
    }

    // Create development session
    const session: Session = {
      id: sessionId,
      userId: 'dev-user',
      repositoryUrl: 'https://github.com/example/repo',
      repositoryName: 'example/repo',
      branch: 'main',
      status: SessionStatus.READY,
      threadId: threadResult.threadId!,
      ampLogPath: threadResult.ampLogPath!,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      expiresAt: new Date(Date.now() + (4 * 60 * 60 * 1000)), // 4 hours
      metadata: {},
      containerId: 'dev-container'
    };

    // Store the session
    sessionStore.createSession(session);

    devLogger.info('Development thread session created', {
      sessionId,
      threadId: threadResult.threadId
    });

    res.json({
      success: true,
      sessionId,
      threadId: threadResult.threadId,
      ampLogPath: threadResult.ampLogPath
    });

  } catch (error) {
    devLogger.error('Error creating development thread session:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Development-only route to get thread messages without authentication
 * GET /api/dev/thread/:sessionId/messages
 */
router.get('/:sessionId/messages', async (req: Request, res: Response): Promise<void> => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({ error: 'Development routes not available in production' });
    return;
  }

  // Create proper request object for the controller
  const threadReq = req as GetThreadMessagesRequest;
  threadReq.params = { sessionId: req.params.sessionId! };
  
  // Call the main thread controller
  await getThreadMessages(threadReq, res);
});

/**
 * Development-only route to get latest thread messages without authentication
 * GET /api/dev/thread/:sessionId/latest
 */
router.get('/:sessionId/latest', async (req: Request, res: Response): Promise<void> => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({ error: 'Development routes not available in production' });
    return;
  }

  const threadReq = req as any;
  threadReq.params = { sessionId: req.params.sessionId! };
  await getLatestThreadMessages(threadReq, res);
});

/**
 * Development-only route to get thread stats without authentication
 * GET /api/dev/thread/:sessionId/stats
 */
router.get('/:sessionId/stats', async (req: Request, res: Response): Promise<void> => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({ error: 'Development routes not available in production' });
    return;
  }

  const threadReq = req as any;
  threadReq.params = { sessionId: req.params.sessionId! };
  await getThreadStats(threadReq, res);
});

/**
 * Development-only route to list all development sessions
 * GET /api/dev/thread/sessions
 */
router.get('/sessions', async (req: Request, res: Response): Promise<void> => {
  try {
    if (process.env.NODE_ENV === 'production') {
      res.status(403).json({ error: 'Development routes not available in production' });
      return;
    }

    const sessions = sessionStore.getUserSessions('dev-user')
      .filter((s: any) => s.id.startsWith('dev-session-'))
      .map((s: any) => ({
        id: s.id,
        threadId: sessionStore.getSession(s.id)?.threadId,
        status: s.status,
        createdAt: s.createdAt,
        repositoryUrl: s.repositoryName,
        branch: s.branch
      }));

    res.json({ sessions });

  } catch (error) {
    devLogger.error('Error listing development sessions:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
