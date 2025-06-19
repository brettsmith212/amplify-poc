import * as fs from 'fs';
import * as path from 'path';
import { ThreadMessage } from '../types/threadMessage';
import { logger } from '../utils/logger';

export interface ThreadMessageQuery {
  limit?: number;
  offset?: number;
  after?: string; // message ID for cursor-based pagination
  before?: string; // message ID for cursor-based pagination
}

export interface ThreadMessageResponse {
  messages: ThreadMessage[];
  hasMore: boolean;
  total: number;
  nextCursor?: string | undefined;
  prevCursor?: string | undefined;
}

export class ThreadStorage {
  private baseDir: string;

  constructor(baseDir: string = 'data/threads') {
    this.baseDir = baseDir;
    this.ensureDirectoryExists();
  }

  /**
   * Append a message to the thread storage file
   */
  async appendMessage(sessionId: string, message: ThreadMessage): Promise<void> {
    try {
      const filePath = this.getThreadFilePath(sessionId);
      
      // Check for duplicates by reading existing messages
      if (await this.messageExists(sessionId, message.id)) {
        return; // Skip duplicate
      }

      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Append message as JSONL
      const messageJson = JSON.stringify(message) + '\n';
      fs.appendFileSync(filePath, messageJson, 'utf8');

      logger.debug('Thread message appended', {
        sessionId,
        messageId: message.id,
        messageType: message.type
      });
    } catch (error) {
      logger.error('Failed to append thread message', {
        sessionId,
        messageId: message.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get messages for a thread with pagination
   */
  async getMessages(sessionId: string, query: ThreadMessageQuery = {}): Promise<ThreadMessageResponse> {
    try {
      const filePath = this.getThreadFilePath(sessionId);
      
      if (!fs.existsSync(filePath)) {
        return {
          messages: [],
          hasMore: false,
          total: 0
        };
      }

      // Read all messages
      const allMessages = await this.readAllMessages(sessionId);
      const total = allMessages.length;

      // Apply pagination
      const { limit = 50, offset = 0, after, before } = query;
      let messages = allMessages;

      // Handle cursor-based pagination
      if (after) {
        const afterIndex = allMessages.findIndex(msg => msg.id === after);
        if (afterIndex >= 0) {
          messages = allMessages.slice(afterIndex + 1);
        }
      } else if (before) {
        const beforeIndex = allMessages.findIndex(msg => msg.id === before);
        if (beforeIndex >= 0) {
          messages = allMessages.slice(0, beforeIndex);
        }
      } else {
        // Handle offset-based pagination
        messages = allMessages.slice(offset);
      }

      // Apply limit
      const hasMore = messages.length > limit;
      if (hasMore) {
        messages = messages.slice(0, limit);
      }

      // Generate cursors
      const nextCursor = hasMore && messages.length > 0 ? messages[messages.length - 1]?.id : undefined;
      const prevCursor = offset > 0 || after ? (messages.length > 0 ? messages[0]?.id : undefined) : undefined;

      return {
        messages,
        hasMore,
        total,
        nextCursor,
        prevCursor
      };
    } catch (error) {
      logger.error('Failed to get thread messages', {
        sessionId,
        query,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get the latest messages for a thread
   */
  async getLatestMessages(sessionId: string, count: number = 10): Promise<ThreadMessage[]> {
    try {
      const allMessages = await this.readAllMessages(sessionId);
      return allMessages.slice(-count);
    } catch (error) {
      logger.error('Failed to get latest thread messages', {
        sessionId,
        count,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Check if a message already exists in the thread
   */
  async messageExists(sessionId: string, messageId: string): Promise<boolean> {
    try {
      const filePath = this.getThreadFilePath(sessionId);
      
      if (!fs.existsSync(filePath)) {
        return false;
      }

      const content = fs.readFileSync(filePath, 'utf8');
      return content.includes(`"id":"${messageId}"`);
    } catch (error) {
      logger.warn('Failed to check message existence', {
        sessionId,
        messageId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Clear all messages for a thread
   */
  async clearMessages(sessionId: string): Promise<void> {
    try {
      const filePath = this.getThreadFilePath(sessionId);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      logger.debug('Thread messages cleared', { sessionId });
    } catch (error) {
      logger.error('Failed to clear thread messages', {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get thread statistics
   */
  async getThreadStats(sessionId: string): Promise<{ messageCount: number; lastMessageTime?: Date | undefined }> {
    try {
      const allMessages = await this.readAllMessages(sessionId);
      const messageCount = allMessages.length;
      const lastMessageTime = allMessages.length > 0 
        ? new Date(allMessages[allMessages.length - 1]?.timestamp || 0)
        : undefined;

      return { messageCount, lastMessageTime };
    } catch (error) {
      logger.error('Failed to get thread stats', {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      return { messageCount: 0, lastMessageTime: undefined };
    }
  }

  /**
   * Read all messages from the thread file
   */
  private async readAllMessages(sessionId: string): Promise<ThreadMessage[]> {
    const filePath = this.getThreadFilePath(sessionId);
    
    if (!fs.existsSync(filePath)) {
      return [];
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    
    const messages: ThreadMessage[] = [];
    
    for (const line of lines) {
      try {
        const message = JSON.parse(line) as ThreadMessage;
        // Ensure timestamp is a Date object
        message.timestamp = new Date(message.timestamp);
        messages.push(message);
      } catch (error) {
        logger.warn('Failed to parse thread message line', {
          sessionId,
          line: line.substring(0, 100),
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Sort by timestamp to ensure chronological order
    messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    return messages;
  }

  /**
   * Get the file path for a thread
   */
  private getThreadFilePath(sessionId: string): string {
    return path.join(this.baseDir, `thread_${sessionId}.jsonl`);
  }

  /**
   * Ensure the base directory exists
   */
  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }
}

// Export singleton instance
export const threadStorage = new ThreadStorage();
