import { Router } from 'express';
import {
  getThreadMessages,
  getLatestThreadMessages,
  getThreadStats,
  clearThreadMessages
} from '../controllers/threadController';

const router = Router();

/**
 * GET /api/sessions/:sessionId/thread
 * Get thread messages with pagination
 * 
 * Query parameters:
 * - limit: number (1-100, default: 50) - Number of messages to return
 * - offset: number (default: 0) - Number of messages to skip
 * - after: string - Message ID to start after (cursor-based pagination)
 * - before: string - Message ID to end before (cursor-based pagination)
 * 
 * Example: GET /api/sessions/session_123/thread?limit=20&offset=0
 */
router.get('/sessions/:sessionId/thread', getThreadMessages);

/**
 * GET /api/sessions/:sessionId/thread/latest
 * Get latest thread messages
 * 
 * Query parameters:
 * - count: number (1-50, default: 10) - Number of latest messages to return
 * 
 * Example: GET /api/sessions/session_123/thread/latest?count=5
 */
router.get('/sessions/:sessionId/thread/latest', getLatestThreadMessages);

/**
 * GET /api/sessions/:sessionId/thread/stats
 * Get thread statistics
 * 
 * Returns:
 * - sessionId: string
 * - messageCount: number
 * - lastMessageTime: string (ISO 8601) | undefined
 * 
 * Example: GET /api/sessions/session_123/thread/stats
 */
router.get('/sessions/:sessionId/thread/stats', getThreadStats);

/**
 * DELETE /api/sessions/:sessionId/thread
 * Clear all thread messages (for testing/development)
 * 
 * Example: DELETE /api/sessions/session_123/thread
 */
router.delete('/sessions/:sessionId/thread', clearThreadMessages);

export default router;
