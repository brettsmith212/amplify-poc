import request from 'supertest';
import express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import threadRoutes from '../../routes/threads';
import { threadStorage } from '../../services/threadStorage';
import { ThreadMessage, MessageType } from '../../types/threadMessage';

describe('Thread Routes', () => {
  let app: express.Application;
  let tempDir: string;
  let originalBaseDir: string;

  beforeAll(() => {
    // Create test app
    app = express();
    app.use(express.json());
    app.use('/api', threadRoutes);

    // Setup temporary directory for test data
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'thread-api-test-'));
    originalBaseDir = (threadStorage as any).baseDir;
    (threadStorage as any).baseDir = tempDir;
  });

  afterAll(() => {
    // Restore original base directory
    (threadStorage as any).baseDir = originalBaseDir;
    
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  afterEach(async () => {
    // Clear all test data
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        fs.unlinkSync(path.join(tempDir, file));
      }
    }
  });

  const createTestMessage = (id: string, type: MessageType, content: string, timestamp?: Date): ThreadMessage => {
    const message: ThreadMessage = {
      id,
      type,
      content,
      timestamp: timestamp || new Date()
    };
    
    if (type === MessageType.TOOL) {
      message.metadata = { tool_name: 'test_tool' };
    }
    
    return message;
  };

  describe('GET /api/sessions/:sessionId/thread', () => {
    it('should return empty array for non-existent session', async () => {
      const response = await request(app)
        .get('/api/sessions/nonexistent/thread')
        .expect(200);

      expect(response.body).toEqual({
        messages: [],
        hasMore: false,
        total: 0
      });
    });

    it('should return messages with default pagination', async () => {
      const sessionId = 'test-session-1';
      
      // Add test messages
      const messages = [
        createTestMessage('msg1', MessageType.USER, 'Hello'),
        createTestMessage('msg2', MessageType.ASSISTANT, 'Hi there!'),
        createTestMessage('msg3', MessageType.TOOL, 'Running command'),
      ];

      for (const message of messages) {
        await threadStorage.appendMessage(sessionId, message);
      }

      const response = await request(app)
        .get(`/api/sessions/${sessionId}/thread`)
        .expect(200);

      expect(response.body.messages).toHaveLength(3);
      expect(response.body.total).toBe(3);
      expect(response.body.hasMore).toBe(false);
      expect(response.body.messages[0].id).toBe('msg1');
      expect(response.body.messages[0].type).toBe(MessageType.USER);
      expect(response.body.messages[0].content).toBe('Hello');
    });

    it('should handle limit parameter', async () => {
      const sessionId = 'test-session-2';
      
      // Add 5 test messages
      for (let i = 1; i <= 5; i++) {
        await threadStorage.appendMessage(
          sessionId,
          createTestMessage(`msg${i}`, MessageType.USER, `Message ${i}`)
        );
      }

      const response = await request(app)
        .get(`/api/sessions/${sessionId}/thread?limit=3`)
        .expect(200);

      expect(response.body.messages).toHaveLength(3);
      expect(response.body.total).toBe(5);
      expect(response.body.hasMore).toBe(true);
      expect(response.body.nextCursor).toBeDefined();
    });

    it('should handle offset parameter', async () => {
      const sessionId = 'test-session-3';
      
      // Add 5 test messages
      for (let i = 1; i <= 5; i++) {
        await threadStorage.appendMessage(
          sessionId,
          createTestMessage(`msg${i}`, MessageType.USER, `Message ${i}`)
        );
      }

      const response = await request(app)
        .get(`/api/sessions/${sessionId}/thread?offset=2&limit=2`)
        .expect(200);

      expect(response.body.messages).toHaveLength(2);
      expect(response.body.total).toBe(5);
      expect(response.body.messages[0].content).toBe('Message 3');
      expect(response.body.messages[1].content).toBe('Message 4');
    });

    it('should validate limit parameter', async () => {
      const response = await request(app)
        .get('/api/sessions/test/thread?limit=150')
        .expect(400);

      expect(response.body.error).toContain('Limit must be between 1 and 100');
    });

    it('should validate offset parameter', async () => {
      const response = await request(app)
        .get('/api/sessions/test/thread?offset=-1')
        .expect(400);

      expect(response.body.error).toContain('Offset must be a non-negative integer');
    });

    it('should handle cursor-based pagination with after parameter', async () => {
      const sessionId = 'test-session-4';
      
      // Add test messages
      const messages = [
        createTestMessage('msg1', MessageType.USER, 'Message 1'),
        createTestMessage('msg2', MessageType.USER, 'Message 2'),
        createTestMessage('msg3', MessageType.USER, 'Message 3'),
        createTestMessage('msg4', MessageType.USER, 'Message 4'),
      ];

      for (const message of messages) {
        await threadStorage.appendMessage(sessionId, message);
      }

      const response = await request(app)
        .get(`/api/sessions/${sessionId}/thread?after=msg2&limit=2`)
        .expect(200);

      expect(response.body.messages).toHaveLength(2);
      expect(response.body.messages[0].id).toBe('msg3');
      expect(response.body.messages[1].id).toBe('msg4');
    });
  });

  describe('GET /api/sessions/:sessionId/thread/latest', () => {
    it('should return latest messages', async () => {
      const sessionId = 'test-session-latest';
      
      // Add test messages with different timestamps
      const baseTime = new Date('2024-01-01T10:00:00Z');
      for (let i = 1; i <= 5; i++) {
        const timestamp = new Date(baseTime.getTime() + i * 1000);
        await threadStorage.appendMessage(
          sessionId,
          createTestMessage(`msg${i}`, MessageType.USER, `Message ${i}`, timestamp)
        );
      }

      const response = await request(app)
        .get(`/api/sessions/${sessionId}/thread/latest?count=3`)
        .expect(200);

      expect(response.body).toHaveLength(3);
      expect(response.body[0].content).toBe('Message 3');
      expect(response.body[1].content).toBe('Message 4');
      expect(response.body[2].content).toBe('Message 5');
    });

    it('should validate count parameter', async () => {
      const response = await request(app)
        .get('/api/sessions/test/thread/latest?count=100')
        .expect(400);

      expect(response.body.error).toContain('Count must be between 1 and 50');
    });
  });

  describe('GET /api/sessions/:sessionId/thread/stats', () => {
    it('should return thread statistics', async () => {
      const sessionId = 'test-session-stats';
      
      // Add test messages
      const timestamp1 = new Date('2024-01-01T10:00:00Z');
      const timestamp2 = new Date('2024-01-01T10:01:00Z');
      
      await threadStorage.appendMessage(
        sessionId,
        createTestMessage('msg1', MessageType.USER, 'Message 1', timestamp1)
      );
      await threadStorage.appendMessage(
        sessionId,
        createTestMessage('msg2', MessageType.USER, 'Message 2', timestamp2)
      );

      const response = await request(app)
        .get(`/api/sessions/${sessionId}/thread/stats`)
        .expect(200);

      expect(response.body.sessionId).toBe(sessionId);
      expect(response.body.messageCount).toBe(2);
      expect(response.body.lastMessageTime).toBe(timestamp2.toISOString());
    });

    it('should return zero stats for non-existent session', async () => {
      const response = await request(app)
        .get('/api/sessions/nonexistent/thread/stats')
        .expect(200);

      expect(response.body.sessionId).toBe('nonexistent');
      expect(response.body.messageCount).toBe(0);
      expect(response.body.lastMessageTime).toBeUndefined();
    });
  });

  describe('DELETE /api/sessions/:sessionId/thread', () => {
    it('should clear thread messages', async () => {
      const sessionId = 'test-session-clear';
      
      // Add test messages
      await threadStorage.appendMessage(
        sessionId,
        createTestMessage('msg1', MessageType.USER, 'Message 1')
      );
      await threadStorage.appendMessage(
        sessionId,
        createTestMessage('msg2', MessageType.USER, 'Message 2')
      );

      // Verify messages exist
      const beforeStats = await threadStorage.getThreadStats(sessionId);
      expect(beforeStats.messageCount).toBe(2);

      // Clear messages
      const response = await request(app)
        .delete(`/api/sessions/${sessionId}/thread`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify messages are cleared
      const afterStats = await threadStorage.getThreadStats(sessionId);
      expect(afterStats.messageCount).toBe(0);
    });
  });

  describe('Message format validation', () => {
    it('should return properly formatted DTOs', async () => {
      const sessionId = 'test-session-format';
      
      const testMessage = createTestMessage(
        'test-msg', 
        MessageType.TOOL, 
        'Test content',
        new Date('2024-01-01T10:00:00Z')
      );
      testMessage.metadata = { tool_name: 'test_tool', custom_field: 'value' };

      await threadStorage.appendMessage(sessionId, testMessage);

      const response = await request(app)
        .get(`/api/sessions/${sessionId}/thread`)
        .expect(200);

      const message = response.body.messages[0];
      expect(message).toEqual({
        id: 'test-msg',
        type: MessageType.TOOL,
        content: 'Test content',
        timestamp: '2024-01-01T10:00:00.000Z',
        metadata: {
          tool_name: 'test_tool',
          custom_field: 'value'
        }
      });
    });
  });
});
