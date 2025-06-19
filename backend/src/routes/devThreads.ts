import { Router, Request, Response } from 'express';
import { sessionStore } from '../services/sessionStore';
import { ampService } from '../services/ampService';
import * as fs from 'fs/promises';
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

interface ParsedMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * Get the structured message store path for a session
 */
function getMessageStorePath(sessionId: string): string {
  return `/tmp/amplify-data/${sessionId}/messages.json`;
}

/**
 * Load messages from structured message store
 */
async function loadSessionMessages(sessionId: string): Promise<ParsedMessage[]> {
  try {
    const messageStorePath = getMessageStorePath(sessionId);
    devLogger.info('Loading session messages', { sessionId, messageStorePath });
    const content = await fs.readFile(messageStorePath, 'utf-8');
    const messages = JSON.parse(content);
    devLogger.info('Session messages loaded successfully', { sessionId, messageCount: messages.length });
    return messages;
  } catch (error) {
    devLogger.info('No session messages file found, returning empty array', { sessionId, error: error instanceof Error ? error.message : 'Unknown error' });
    // If file doesn't exist or can't be read, return empty array
    return [];
  }
}

/**
 * Save messages to structured message store
 */
async function saveSessionMessages(sessionId: string, messages: ParsedMessage[]): Promise<void> {
  try {
    const messageStorePath = getMessageStorePath(sessionId);
    const dirPath = `/tmp/amplify-data/${sessionId}`;
    
    // Ensure directory exists
    await fs.mkdir(dirPath, { recursive: true });
    
    devLogger.info('Saving session messages', { sessionId, messageStorePath, messageCount: messages.length });
    await fs.writeFile(messageStorePath, JSON.stringify(messages, null, 2));
    devLogger.info('Session messages saved successfully', { sessionId, messageStorePath });
  } catch (error) {
    devLogger.error('Error saving session messages:', { sessionId, error });
    throw error;
  }
}

/**
 * Add a message to the session message store
 */
async function addSessionMessage(sessionId: string, message: ParsedMessage): Promise<void> {
  try {
    devLogger.info('Adding session message', { sessionId, messageType: message.type, messageLength: message.content.length });
    const messages = await loadSessionMessages(sessionId);
    messages.push(message);
    await saveSessionMessages(sessionId, messages);
    devLogger.info('Session message saved successfully', { sessionId, totalMessages: messages.length });
  } catch (error) {
    devLogger.error('Error adding session message', { sessionId, error });
    throw error;
  }
}

/**
 * Extract only the new assistant response from the full conversation output
 */
async function extractNewAssistantResponse(sessionId: string, fullResponse: string): Promise<string> {
  try {
    // Get existing messages to build the expected conversation so far
    const existingMessages = await loadSessionMessages(sessionId);
    
    // Build the expected conversation content from existing assistant messages
    const existingAssistantContent = existingMessages
      .filter(msg => msg.type === 'assistant')
      .map(msg => msg.content)
      .join('\n\n');
    
    devLogger.info('Extracting new assistant response', { 
      sessionId, 
      fullResponseLength: fullResponse.length,
      existingContentLength: existingAssistantContent.length,
      existingAssistantMessages: existingMessages.filter(msg => msg.type === 'assistant').length
    });
    
    // If this is the first assistant message, return the full response
    if (!existingAssistantContent.trim()) {
      devLogger.info('First assistant message, returning full response', { sessionId });
      return fullResponse.trim();
    }
    
    // Find where the existing content ends in the full response
    const existingContentInResponse = fullResponse.indexOf(existingAssistantContent);
    
    if (existingContentInResponse !== -1) {
      // Extract everything after the existing content
      const startIndex = existingContentInResponse + existingAssistantContent.length;
      const newContent = fullResponse.substring(startIndex).trim();
      
      devLogger.info('Extracted new content after existing', { 
        sessionId, 
        newContentLength: newContent.length,
        newContentPreview: newContent.substring(0, 100)
      });
      
      return newContent;
    } else {
      // Fallback: try to find common patterns and extract the new part
      // This handles cases where the response format might be slightly different
      
      // Split the response into parts and try to find the new content
      const responseLines = fullResponse.split('\n').filter(line => line.trim());
      const existingLines = existingAssistantContent.split('\n').filter(line => line.trim());
      
      // Find the last common line and extract everything after it
      let newLines: string[] = [];
      let foundDivergence = false;
      
      for (let i = 0; i < responseLines.length; i++) {
        const responseLine = responseLines[i];
        const existingLine = existingLines[i];
        
        if (i < existingLines.length && responseLine && existingLine && responseLine.trim() === existingLine.trim()) {
          // This line matches existing content, skip it
          continue;
        } else {
          // Found new content, take everything from here
          newLines = responseLines.slice(i);
          foundDivergence = true;
          break;
        }
      }
      
      if (foundDivergence && newLines.length > 0) {
        const newContent = newLines.join('\n').trim();
        devLogger.info('Extracted new content via line-by-line comparison', { 
          sessionId, 
          newContentLength: newContent.length 
        });
        return newContent;
      }
      
      // Last resort: if we can't parse it properly, return the full response
      // but log a warning
      devLogger.warn('Could not extract incremental response, returning full response', { 
        sessionId,
        fullResponsePreview: fullResponse.substring(0, 200)
      });
      
      return fullResponse.trim();
    }
  } catch (error) {
    devLogger.error('Error extracting new assistant response', { sessionId, error });
    // Fallback to full response if extraction fails
    return fullResponse.trim();
  }
}

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
 * Development-only route to send a message to amp
 * POST /api/dev/thread/:sessionId/message
 */
router.post('/:sessionId/message', async (req: Request, res: Response): Promise<void> => {
  try {
    if (process.env.NODE_ENV === 'production') {
      res.status(403).json({ error: 'Development routes not available in production' });
      return;
    }

    const { sessionId } = req.params;
    const { content } = req.body;

    if (!sessionId) {
      res.status(400).json({ error: 'Session ID is required' });
      return;
    }

    if (!content || typeof content !== 'string') {
      res.status(400).json({ error: 'Message content is required' });
      return;
    }

    // Get the session
    const session = sessionStore.getSession(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    if (!session.threadId) {
      res.status(400).json({ error: 'Session does not have a thread ID' });
      return;
    }

    if (!session.ampLogPath) {
      res.status(400).json({ error: 'Session does not have an amp log path' });
      return;
    }

    devLogger.info('Sending message to amp thread', {
      sessionId,
      threadId: session.threadId,
      messageLength: content.length
    });

    // Store the user message immediately
    const userMessage: ParsedMessage = {
      id: `user-${Date.now()}-${Math.random()}`,
      type: 'user',
      content,
      timestamp: new Date().toISOString(),
      metadata: { source: 'api' }
    };
    
    await addSessionMessage(sessionId, userMessage);

    // Send message to amp using amp threads continue
    const result = await ampService.continueThread(session.threadId, content, {
      workingDirectory: `/tmp/amplify-data/${sessionId}`,
      ampLogPath: session.ampLogPath
    });

    if (!result.success) {
      devLogger.error('Failed to send message to amp', {
        sessionId,
        threadId: session.threadId,
        error: result.error
      });

      res.status(500).json({
        error: 'Failed to send message to amp',
        message: result.error
      });
      return;
    }

    // Extract only the new assistant response (not the full conversation)
    const newAssistantContent = await extractNewAssistantResponse(sessionId, result.response || '');
    
    if (newAssistantContent.trim()) {
      const assistantMessage: ParsedMessage = {
        id: `assistant-${Date.now()}-${Math.random()}`,
        type: 'assistant',
        content: newAssistantContent,
        timestamp: new Date().toISOString(),
        metadata: { source: 'amp' }
      };
      
      await addSessionMessage(sessionId, assistantMessage);
    }

    devLogger.info('Message sent to amp successfully', {
      sessionId,
      threadId: session.threadId,
      responseLength: result.response?.length || 0,
      incrementalResponseLength: newAssistantContent.length
    });

    res.json({
      success: true,
      response: newAssistantContent, // Return only the incremental response, not the full conversation
      fullResponse: result.response, // Include full response for debugging if needed
      threadId: session.threadId
    });

  } catch (error) {
    devLogger.error('Error sending message to amp:', error);
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
  try {
    if (process.env.NODE_ENV === 'production') {
      res.status(403).json({ error: 'Development routes not available in production' });
      return;
    }

    const { sessionId } = req.params;
    if (!sessionId) {
      res.status(400).json({ error: 'Session ID is required' });
      return;
    }
    
    const session = sessionStore.getSession(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Load messages from structured message store
    devLogger.info('About to load session messages for route', { sessionId });
    const messages = await loadSessionMessages(sessionId);
    devLogger.info('Messages loaded in route', { sessionId, messageCount: messages.length });
    
    res.json({
      messages,
      hasMore: false,
      total: messages.length
    });

  } catch (error) {
    devLogger.error('Error getting thread messages:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
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
  try {
    if (process.env.NODE_ENV === 'production') {
      res.status(403).json({ error: 'Development routes not available in production' });
      return;
    }

    const { sessionId } = req.params;
    if (!sessionId) {
      res.status(400).json({ error: 'Session ID is required' });
      return;
    }
    
    const session = sessionStore.getSession(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Get message count from log file
    let messageCount = 0;
    let lastMessageTime: string | undefined;
    
    try {
      const messages = await loadSessionMessages(sessionId);
      messageCount = messages.length;
      if (messages.length > 0) {
        lastMessageTime = messages[messages.length - 1]?.timestamp;
      }
    } catch (error) {
      // Log error but continue with default values
      devLogger.warn('Failed to load messages for stats:', { sessionId, error });
    }

    res.json({
      sessionId,
      messageCount,
      lastMessageTime,
      threadId: session.threadId,
      status: session.status
    });

  } catch (error) {
    devLogger.error('Error getting thread stats:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
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

    const sessions = await Promise.all(
      sessionStore.getUserSessions('dev-user')
        .filter((s: any) => s.id.startsWith('dev-session-'))
        .map(async (s: any) => {
          const session = sessionStore.getSession(s.id);
          const messages = await loadSessionMessages(s.id);
          const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
          
          return {
            sessionId: s.id,
            threadId: session?.threadId,
            status: s.status,
            createdAt: s.createdAt,
            lastAccessedAt: s.lastAccessedAt,
            messageCount: messages.length,
            lastMessage: lastMessage ? {
              content: lastMessage.content.substring(0, 100) + (lastMessage.content.length > 100 ? '...' : ''),
              timestamp: lastMessage.timestamp,
              type: lastMessage.type
            } : null,
            repositoryUrl: s.repositoryName,
            branch: s.branch
          };
        })
    );

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
