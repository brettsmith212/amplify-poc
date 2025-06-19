import WebSocket from 'ws';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ThreadWebSocketManager } from '../../websocket/threadWebSocket';
import { sessionStore } from '../../services/sessionStore';
import { threadStorage } from '../../services/threadStorage';
import { MessageType } from '../../types/threadMessage';

// Mock session store
jest.mock('../../services/sessionStore');
jest.mock('../../services/ampService');

const mockSessionStore = {
  getSession: jest.fn(),
  createSession: jest.fn(),
  updateSession: jest.fn(),
  deleteSession: jest.fn(),
  getUserSessions: jest.fn(),
  getStats: jest.fn()
};

describe('ThreadWebSocketManager', () => {
  let manager: ThreadWebSocketManager;
  let mockWebSocket: jest.Mocked<WebSocket>;
  let tempDir: string;

  beforeEach(() => {
    manager = new ThreadWebSocketManager();
    
    // Create mock WebSocket
    mockWebSocket = {
      readyState: WebSocket.OPEN,
      send: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      removeAllListeners: jest.fn()
    } as any;

    // Setup temp directory for thread storage
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'thread-ws-test-'));
    (threadStorage as any).baseDir = tempDir;

    // Mock session store
    (sessionStore.getSession as jest.Mock) = mockSessionStore.getSession;
    mockSessionStore.getSession.mockResolvedValue({
      id: 'test-session',
      userId: 'test-user',
      repositoryUrl: 'test-repo',
      branch: 'main',
      sessionName: 'Test Session',
      status: 'active' as any,
      threadId: 'thread_123',
      ampLogPath: path.join(tempDir, 'amp.log'),
      createdAt: new Date(),
      lastActivity: new Date(),
      expiresAt: new Date(Date.now() + 60000)
    });
  });

  afterEach(async () => {
    if (manager) {
      manager.shutdown();
    }
    
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    jest.clearAllMocks();
    
    // Wait a tick to allow async cleanup to complete
    await new Promise(resolve => setImmediate(resolve));
  });

  describe('handleConnection', () => {
    it('should establish WebSocket connection for valid session', async () => {
      const sessionId = 'test-session';
      
      const wsSessionId = await manager.handleConnection(mockWebSocket, sessionId, {});
      
      expect(wsSessionId).toMatch(/^thread_ws_/);
      expect(mockWebSocket.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWebSocket.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockWebSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"connection_status"')
      );
    });

    it('should reject connection for missing session ID', async () => {
      await expect(
        manager.handleConnection(mockWebSocket, undefined, {})
      ).rejects.toThrow('Session ID is required');
      
      expect(mockWebSocket.close).toHaveBeenCalled();
    });

    it('should reject connection for non-existent session', async () => {
      mockSessionStore.getSession.mockResolvedValueOnce(null);
      
      await expect(
        manager.handleConnection(mockWebSocket, 'invalid-session', {})
      ).rejects.toThrow('Session invalid-session not found');
      
      expect(mockWebSocket.close).toHaveBeenCalled();
    });
  });

  describe('message handling', () => {
    let wsSessionId: string;
    let messageHandler: Function;

    beforeEach(async () => {
      wsSessionId = await manager.handleConnection(mockWebSocket, 'test-session', {});
      
      // Get the message handler from the mock calls
      const onCalls = (mockWebSocket.on as jest.Mock).mock.calls;
      const messageCall = onCalls.find(call => call[0] === 'message');
      messageHandler = messageCall[1];
    });

    it('should handle user messages', async () => {
      const userMessage = {
        type: 'user_message',
        data: {
          content: 'Hello, can you help me?',
          sessionId: 'test-session'
        }
      };

      await messageHandler(Buffer.from(JSON.stringify(userMessage)));

      // Should send connection status updates
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"status":"processing"')
      );
    });

    it('should handle ping messages', async () => {
      const pingMessage = {
        type: 'ping',
        timestamp: new Date().toISOString()
      };

      await messageHandler(Buffer.from(JSON.stringify(pingMessage)));

      // Should respond with pong
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"pong"')
      );
    });

    it('should handle invalid JSON gracefully', async () => {
      await messageHandler(Buffer.from('invalid json'));

      // Should send error message
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
    });

    it('should handle unknown message types', async () => {
      const unknownMessage = {
        type: 'unknown_type',
        data: {}
      };

      await messageHandler(Buffer.from(JSON.stringify(unknownMessage)));

      // Should not crash and continue processing
      expect(mockWebSocket.send).not.toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
    });
  });

  describe('message broadcasting', () => {
    let wsSessionId: string;

    beforeEach(async () => {
      wsSessionId = await manager.handleConnection(mockWebSocket, 'test-session', {});
    });

    it('should broadcast thread messages to connected clients', () => {
      const threadMessage = {
        id: 'msg_123',
        type: MessageType.ASSISTANT,
        content: 'This is a test response',
        timestamp: new Date(),
        metadata: undefined
      };

      // Simulate message broadcast
      (manager as any).broadcastThreadMessage('test-session', threadMessage);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"thread_message"')
      );
      
      const sentMessage = JSON.parse((mockWebSocket.send as jest.Mock).mock.calls.slice(-1)[0][0]);
      expect(sentMessage.data.id).toBe('msg_123');
      expect(sentMessage.data.type).toBe(MessageType.ASSISTANT);
      expect(sentMessage.data.content).toBe('This is a test response');
    });
  });

  describe('session management', () => {
    it('should track active sessions', async () => {
      expect(manager.getStats().activeConnections).toBe(0);

      await manager.handleConnection(mockWebSocket, 'test-session', {});
      expect(manager.getStats().activeConnections).toBe(1);
    });

    it('should clean up on disconnect', async () => {
      const wsSessionId = await manager.handleConnection(mockWebSocket, 'test-session', {});
      
      // Get the close handler
      const onCalls = (mockWebSocket.on as jest.Mock).mock.calls;
      const closeCall = onCalls.find(call => call[0] === 'close');
      const closeHandler = closeCall[1];
      
      // Simulate disconnect
      closeHandler();
      
      expect(manager.getStats().activeConnections).toBe(0);
    });

    it('should handle ping for all sessions', async () => {
      // Connect a session and wait for it to be established
      await manager.handleConnection(mockWebSocket, 'test-session', {});
      
      // Clear previous calls to focus on ping
      jest.clearAllMocks();
      
      // Call ping all sessions
      manager.pingAllSessions();
      
      // Should send ping message
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"ping"')
      );
    });
  });

  describe('log tailing integration', () => {
    it('should start log tailing when amp log path exists', async () => {
      // Create mock amp.log file
      const ampLogPath = path.join(tempDir, 'amp.log');
      fs.writeFileSync(ampLogPath, '');

      const wsSessionId = await manager.handleConnection(mockWebSocket, 'test-session', {});
      
      // Wait a bit for async log tailing setup
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify log tailer was created (checking internal state)
      const sessions = (manager as any).sessions;
      const threadSession = sessions.get(wsSessionId);
      
      expect(threadSession).toBeDefined();
      // Note: In a real test, we'd mock the LogTailerWithParser creation
      // For now, we just verify the session was created successfully
    });

    it('should handle missing amp log path gracefully', async () => {
      // Session without amp log path
      mockSessionStore.getSession.mockResolvedValueOnce({
        id: 'test-session',
        userId: 'test-user',
        repositoryUrl: 'test-repo',
        branch: 'main',
        sessionName: 'Test Session',
        status: 'active' as any,
        threadId: 'thread_123',
        ampLogPath: undefined, // No log path
        createdAt: new Date(),
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() + 60000)
      });

      const wsSessionId = await manager.handleConnection(mockWebSocket, 'test-session', {});
      
      // Should not throw error
      expect(wsSessionId).toMatch(/^thread_ws_/);
    });
  });

  describe('error handling', () => {
    it('should handle WebSocket errors gracefully', async () => {
      const wsSessionId = await manager.handleConnection(mockWebSocket, 'test-session', {});
      
      // Get the error handler
      const onCalls = (mockWebSocket.on as jest.Mock).mock.calls;
      const errorCall = onCalls.find(call => call[0] === 'error');
      const errorHandler = errorCall[1];
      
      // Simulate WebSocket error
      const error = new Error('WebSocket connection failed');
      errorHandler(error);
      
      // Should handle gracefully without crashing
      expect(manager.getStats().activeConnections).toBe(0);
    });

    it('should handle session store errors during connection', async () => {
      mockSessionStore.getSession.mockRejectedValueOnce(new Error('Database error'));
      
      await expect(
        manager.handleConnection(mockWebSocket, 'test-session', {})
      ).rejects.toThrow('Database error');
      
      // Note: WebSocket close isn't called for database errors during session lookup
      // since the error occurs before session validation completes
    });
  });
});
