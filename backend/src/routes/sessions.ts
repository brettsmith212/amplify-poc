/**
 * Multi-session CRUD endpoints
 */

import { Router, Request, Response } from 'express';
import { 
  authenticateUser, 
  requireAuth, 
  getAuthenticatedUser 
} from '../middleware/auth';
import { generalRateLimit } from '../middleware/rateLimit';
import * as sessionController from '../controllers/sessionController';
import { logger } from '../utils/logger';

const sessionRoutesLogger = logger.child('SessionRoutes');
const router = Router();

// Apply authentication and rate limiting to all routes
router.use(authenticateUser);
router.use(requireAuth);
router.use(generalRateLimit.middleware);

/**
 * GET /api/sessions
 * Get all sessions for the authenticated user
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = getAuthenticatedUser(req)!;
    
    sessionRoutesLogger.info('Fetching user sessions', {
      userId: user.id,
      username: user.username
    });

    const result = await sessionController.getUserSessions(user.id);

    if (!result.success) {
      sessionRoutesLogger.error('Failed to fetch user sessions', {
        userId: user.id,
        error: result.error
      });

      res.status(500).json({
        error: 'Failed to fetch sessions',
        message: result.error
      });
      return;
    }

    res.json({
      success: true,
      data: result.data,
      meta: {
        total: result.data?.length || 0,
        userId: user.id
      }
    });

  } catch (error: any) {
    sessionRoutesLogger.error('Error in GET /sessions', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch sessions'
    });
  }
});

/**
 * POST /api/sessions
 * Create a new session with GitHub repository cloning
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = getAuthenticatedUser(req)!;
    const { repositoryUrl, branch, sessionName } = req.body;

    // Validate required fields
    if (!repositoryUrl) {
      res.status(400).json({
        error: 'Invalid request',
        message: 'Repository URL is required'
      });
      return;
    }

    sessionRoutesLogger.info('Creating new session', {
      userId: user.id,
      username: user.username,
      repositoryUrl,
      branch: branch || 'main',
      sessionName: sessionName || 'Untitled Session'
    });

    const sessionData = {
      repositoryUrl,
      branch: branch || 'main',
      sessionName: sessionName || 'Untitled Session'
    };

    const result = await sessionController.createSession(user, sessionData);

    if (!result.success) {
      const statusCode = result.error?.includes('already exists') ? 409 : 
                        result.error?.includes('not found') ? 404 :
                        result.error?.includes('access denied') ? 403 : 500;

      sessionRoutesLogger.error('Failed to create session', {
        userId: user.id,
        error: result.error,
        statusCode,
        sessionData
      });

      res.status(statusCode).json({
        error: 'Failed to create session',
        message: result.error
      });
      return;
    }

    sessionRoutesLogger.info('Session created successfully', {
      userId: user.id,
      sessionId: result.data?.id,
      repositoryUrl
    });

    res.status(201).json({
      success: true,
      data: result.data,
      message: 'Session created successfully'
    });

  } catch (error: any) {
    sessionRoutesLogger.error('Error in POST /sessions', {
      error: error.message,
      stack: error.stack,
      body: req.body
    });

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create session'
    });
  }
});

/**
 * GET /api/sessions/:sessionId
 * Get a specific session by ID
 */
router.get('/:sessionId', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = getAuthenticatedUser(req)!;
    const { sessionId } = req.params;

    if (!sessionId) {
      res.status(400).json({
        error: 'Invalid request',
        message: 'Session ID is required'
      });
      return;
    }

    sessionRoutesLogger.info('Fetching session by ID', {
      userId: user.id,
      sessionId
    });

    const result = await sessionController.getSessionById(user.id, sessionId);

    if (!result.success) {
      const statusCode = result.error?.includes('not found') ? 404 : 500;
      
      sessionRoutesLogger.error('Failed to fetch session', {
        userId: user.id,
        sessionId,
        error: result.error,
        statusCode
      });

      res.status(statusCode).json({
        error: 'Failed to fetch session',
        message: result.error
      });
      return;
    }

    res.json({
      success: true,
      data: result.data
    });

  } catch (error: any) {
    sessionRoutesLogger.error('Error in GET /sessions/:sessionId', {
      error: error.message,
      stack: error.stack,
      params: req.params
    });

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch session'
    });
  }
});

/**
 * PUT /api/sessions/:sessionId
 * Update a session (name, prompt, etc.)
 */
router.put('/:sessionId', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = getAuthenticatedUser(req)!;
    const { sessionId } = req.params;
    const updateData = req.body;

    if (!sessionId) {
      res.status(400).json({
        error: 'Invalid request',
        message: 'Session ID is required'
      });
      return;
    }

    sessionRoutesLogger.info('Updating session', {
      userId: user.id,
      sessionId,
      updateData
    });

    const result = await sessionController.updateSession(user.id, sessionId, updateData);

    if (!result.success) {
      const statusCode = result.error?.includes('not found') ? 404 : 500;
      
      sessionRoutesLogger.error('Failed to update session', {
        userId: user.id,
        sessionId,
        error: result.error,
        statusCode
      });

      res.status(statusCode).json({
        error: 'Failed to update session',
        message: result.error
      });
      return;
    }

    sessionRoutesLogger.info('Session updated successfully', {
      userId: user.id,
      sessionId
    });

    res.json({
      success: true,
      data: result.data,
      message: 'Session updated successfully'
    });

  } catch (error: any) {
    sessionRoutesLogger.error('Error in PUT /sessions/:sessionId', {
      error: error.message,
      stack: error.stack,
      params: req.params,
      body: req.body
    });

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update session'
    });
  }
});

/**
 * DELETE /api/sessions/:sessionId
 * Delete a session and cleanup associated resources
 */
router.delete('/:sessionId', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = getAuthenticatedUser(req)!;
    const { sessionId } = req.params;

    if (!sessionId) {
      res.status(400).json({
        error: 'Invalid request',
        message: 'Session ID is required'
      });
      return;
    }

    sessionRoutesLogger.info('Deleting session', {
      userId: user.id,
      sessionId
    });

    const result = await sessionController.deleteSession(user.id, sessionId);

    if (!result.success) {
      const statusCode = result.error?.includes('not found') ? 404 : 500;
      
      sessionRoutesLogger.error('Failed to delete session', {
        userId: user.id,
        sessionId,
        error: result.error,
        statusCode
      });

      res.status(statusCode).json({
        error: 'Failed to delete session',
        message: result.error
      });
      return;
    }

    sessionRoutesLogger.info('Session deleted successfully', {
      userId: user.id,
      sessionId
    });

    res.json({
      success: true,
      message: 'Session deleted successfully'
    });

  } catch (error: any) {
    sessionRoutesLogger.error('Error in DELETE /sessions/:sessionId', {
      error: error.message,
      stack: error.stack,
      params: req.params
    });

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete session'
    });
  }
});

/**
 * POST /api/sessions/:sessionId/start
 * Start/resume a session (creates or reconnects to container)
 */
router.post('/:sessionId/start', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = getAuthenticatedUser(req)!;
    const { sessionId } = req.params;

    if (!sessionId) {
      res.status(400).json({
        error: 'Invalid request',
        message: 'Session ID is required'
      });
      return;
    }

    sessionRoutesLogger.info('Starting session', {
      userId: user.id,
      sessionId
    });

    const result = await sessionController.startSession(user.id, sessionId);

    if (!result.success) {
      const statusCode = result.error?.includes('not found') ? 404 : 500;
      
      sessionRoutesLogger.error('Failed to start session', {
        userId: user.id,
        sessionId,
        error: result.error,
        statusCode
      });

      res.status(statusCode).json({
        error: 'Failed to start session',
        message: result.error
      });
      return;
    }

    sessionRoutesLogger.info('Session started successfully', {
      userId: user.id,
      sessionId,
      containerId: result.data?.containerId
    });

    res.json({
      success: true,
      data: result.data,
      message: 'Session started successfully'
    });

  } catch (error: any) {
    sessionRoutesLogger.error('Error in POST /sessions/:sessionId/start', {
      error: error.message,
      stack: error.stack,
      params: req.params
    });

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to start session'
    });
  }
});

/**
 * POST /api/sessions/:sessionId/stop
 * Stop a session (stops container but keeps session data)
 */
router.post('/:sessionId/stop', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = getAuthenticatedUser(req)!;
    const { sessionId } = req.params;

    if (!sessionId) {
      res.status(400).json({
        error: 'Invalid request',
        message: 'Session ID is required'
      });
      return;
    }

    sessionRoutesLogger.info('Stopping session', {
      userId: user.id,
      sessionId
    });

    const result = await sessionController.stopSession(user.id, sessionId);

    if (!result.success) {
      const statusCode = result.error?.includes('not found') ? 404 : 500;
      
      sessionRoutesLogger.error('Failed to stop session', {
        userId: user.id,
        sessionId,
        error: result.error,
        statusCode
      });

      res.status(statusCode).json({
        error: 'Failed to stop session',
        message: result.error
      });
      return;
    }

    sessionRoutesLogger.info('Session stopped successfully', {
      userId: user.id,
      sessionId
    });

    res.json({
      success: true,
      message: 'Session stopped successfully'
    });

  } catch (error: any) {
    sessionRoutesLogger.error('Error in POST /sessions/:sessionId/stop', {
      error: error.message,
      stack: error.stack,
      params: req.params
    });

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to stop session'
    });
  }
});

/**
 * GET /api/sessions/:sessionId/status
 * Get the current status of a session
 */
router.get('/:sessionId/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = getAuthenticatedUser(req)!;
    const { sessionId } = req.params;

    if (!sessionId) {
      res.status(400).json({
        error: 'Invalid request',
        message: 'Session ID is required'
      });
      return;
    }

    sessionRoutesLogger.debug('Getting session status', {
      userId: user.id,
      sessionId
    });

    const result = await sessionController.getSessionStatus(user.id, sessionId);

    if (!result.success) {
      const statusCode = result.error?.includes('not found') ? 404 : 500;
      
      sessionRoutesLogger.error('Failed to get session status', {
        userId: user.id,
        sessionId,
        error: result.error,
        statusCode
      });

      res.status(statusCode).json({
        error: 'Failed to get session status',
        message: result.error
      });
      return;
    }

    res.json({
      success: true,
      data: result.data
    });

  } catch (error: any) {
    sessionRoutesLogger.error('Error in GET /sessions/:sessionId/status', {
      error: error.message,
      stack: error.stack,
      params: req.params
    });

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get session status'
    });
  }
});

export default router;
