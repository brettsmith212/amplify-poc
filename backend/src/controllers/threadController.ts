import { Request, Response } from 'express';
import { threadStorage, ThreadMessageQuery } from '../services/threadStorage';
import { logger } from '../utils/logger';
import { ThreadMessage } from '../types/threadMessage';

export interface ThreadMessageDTO {
  id: string;
  type: string;
  content: string;
  timestamp: string;
  metadata?: Record<string, any> | undefined;
}

export interface GetThreadMessagesRequest extends Request {
  params: {
    sessionId: string;
  };
  query: {
    limit?: string;
    offset?: string;
    after?: string;
    before?: string;
  };
}

export interface GetThreadMessagesResponse {
  messages: ThreadMessageDTO[];
  hasMore: boolean;
  total: number;
  nextCursor?: string | undefined;
  prevCursor?: string | undefined;
}

export interface ThreadStatsResponse {
  sessionId: string;
  messageCount: number;
  lastMessageTime?: string | undefined;
}

/**
 * Convert ThreadMessage to DTO for API response
 */
function toThreadMessageDTO(message: ThreadMessage): ThreadMessageDTO {
  return {
    id: message.id,
    type: message.type,
    content: message.content,
    timestamp: message.timestamp.toISOString(),
    metadata: message.metadata
  };
}

/**
 * Get thread messages with pagination
 */
export async function getThreadMessages(
  req: GetThreadMessagesRequest,
  res: Response<GetThreadMessagesResponse>
): Promise<void> {
  try {
    const { sessionId } = req.params;
    const { limit, offset, after, before } = req.query;

    // Parse query parameters
    const query: ThreadMessageQuery = {};
    
    if (limit) {
      const limitNum = parseInt(limit, 10);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        res.status(400).json({
          messages: [],
          hasMore: false,
          total: 0,
          error: 'Limit must be between 1 and 100'
        } as any);
        return;
      }
      query.limit = limitNum;
    }
    
    if (offset) {
      const offsetNum = parseInt(offset, 10);
      if (isNaN(offsetNum) || offsetNum < 0) {
        res.status(400).json({
          messages: [],
          hasMore: false,
          total: 0,
          error: 'Offset must be a non-negative integer'
        } as any);
        return;
      }
      query.offset = offsetNum;
    }
    
    if (after) {
      query.after = after;
    }
    
    if (before) {
      query.before = before;
    }

    // Get messages from storage
    const result = await threadStorage.getMessages(sessionId, query);

    // Convert to DTOs
    const messages = result.messages.map(toThreadMessageDTO);

    const response: GetThreadMessagesResponse = {
      messages,
      hasMore: result.hasMore,
      total: result.total,
      nextCursor: result.nextCursor,
      prevCursor: result.prevCursor
    };

    logger.debug('Thread messages retrieved', {
      sessionId,
      messageCount: messages.length,
      total: result.total,
      hasMore: result.hasMore
    });

    res.json(response);
  } catch (error) {
    logger.error('Failed to get thread messages', {
      sessionId: req.params.sessionId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      messages: [],
      hasMore: false,
      total: 0,
      error: 'Internal server error'
    } as any);
  }
}

/**
 * Get latest thread messages
 */
export async function getLatestThreadMessages(
  req: Request<{ sessionId: string }, ThreadMessageDTO[], {}, { count?: string }>,
  res: Response<ThreadMessageDTO[]>
): Promise<void> {
  try {
    const { sessionId } = req.params;
    const { count } = req.query;

    const countNum = count ? parseInt(count, 10) : 10;
    if (isNaN(countNum) || countNum < 1 || countNum > 50) {
      res.status(400).json({
        error: 'Count must be between 1 and 50'
      } as any);
      return;
    }

    const messages = await threadStorage.getLatestMessages(sessionId, countNum);
    const dtoMessages = messages.map(toThreadMessageDTO);

    logger.debug('Latest thread messages retrieved', {
      sessionId,
      messageCount: dtoMessages.length,
      requestedCount: countNum
    });

    res.json(dtoMessages);
  } catch (error) {
    logger.error('Failed to get latest thread messages', {
      sessionId: req.params.sessionId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      error: 'Internal server error'
    } as any);
  }
}

/**
 * Get thread statistics
 */
export async function getThreadStats(
  req: Request<{ sessionId: string }>,
  res: Response<ThreadStatsResponse>
): Promise<void> {
  try {
    const { sessionId } = req.params;

    const stats = await threadStorage.getThreadStats(sessionId);

    const response: ThreadStatsResponse = {
      sessionId,
      messageCount: stats.messageCount,
      lastMessageTime: stats.lastMessageTime?.toISOString()
    };

    logger.debug('Thread stats retrieved', {
      sessionId,
      ...stats
    });

    res.json(response);
  } catch (error) {
    logger.error('Failed to get thread stats', {
      sessionId: req.params.sessionId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      error: 'Internal server error'
    } as any);
  }
}

/**
 * Clear thread messages (for testing/development)
 */
export async function clearThreadMessages(
  req: Request<{ sessionId: string }>,
  res: Response<{ success: boolean; message: string }>
): Promise<void> {
  try {
    const { sessionId } = req.params;

    await threadStorage.clearMessages(sessionId);

    logger.info('Thread messages cleared', { sessionId });

    res.json({
      success: true,
      message: 'Thread messages cleared successfully'
    });
  } catch (error) {
    logger.error('Failed to clear thread messages', {
      sessionId: req.params.sessionId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}
