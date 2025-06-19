import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useThreadHistory from '../../hooks/useThreadHistory';
import { ThreadMessage } from '../../types/threadMessage';

// Mock fetch
const mockFetch = vi.fn();
(globalThis as any).fetch = mockFetch;

describe('useThreadHistory', () => {
  const mockSessionId = 'test-session-123';
  const mockApiBaseUrl = 'http://localhost:3001';

  const mockApiResponse = {
    messages: [
      {
        id: 'msg-1',
        type: 'user_input',
        content: 'Hello world',
        timestamp: '2023-01-01T10:00:00Z',
        metadata: {}
      },
      {
        id: 'msg-2',
        type: 'amp_response',
        content: 'Hi there!',
        timestamp: '2023-01-01T10:01:00Z',
        metadata: {}
      }
    ],
    hasMore: false,
    total: 2,
    nextCursor: undefined,
    prevCursor: undefined
  };

  const expectedMessages: ThreadMessage[] = [
    {
      id: 'msg-1',
      role: 'user',
      content: 'Hello world',
      ts: '2023-01-01T10:00:00Z',
      metadata: {}
    },
    {
      id: 'msg-2',
      role: 'amp',
      content: 'Hi there!',
      ts: '2023-01-01T10:01:00Z',
      metadata: {}
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should initialize with empty state', () => {
      const { result } = renderHook(() =>
        useThreadHistory({
          sessionId: mockSessionId,
          apiBaseUrl: mockApiBaseUrl
        })
      );

      expect(result.current.messages).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.hasMore).toBe(true);
      expect(result.current.totalCount).toBe(0);
      expect(result.current.error).toBeNull();
    });

    it('should auto-load history when autoLoad is true', async () => {
      const { result } = renderHook(() =>
        useThreadHistory({
          sessionId: mockSessionId,
          apiBaseUrl: mockApiBaseUrl,
          autoLoad: true
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockApiBaseUrl}/api/sessions/${mockSessionId}/thread?limit=50`
      );
      expect(result.current.messages).toEqual(expectedMessages);
      expect(result.current.totalCount).toBe(2);
      expect(result.current.hasMore).toBe(false);
    });

    it('should not auto-load history when autoLoad is false', () => {
      renderHook(() =>
        useThreadHistory({
          sessionId: mockSessionId,
          apiBaseUrl: mockApiBaseUrl,
          autoLoad: false
        })
      );

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Manual History Loading', () => {
    it('should load history manually', async () => {
      const { result } = renderHook(() =>
        useThreadHistory({
          sessionId: mockSessionId,
          apiBaseUrl: mockApiBaseUrl
        })
      );

      await act(async () => {
        await result.current.loadHistory();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockApiBaseUrl}/api/sessions/${mockSessionId}/thread?limit=50`
      );
      expect(result.current.messages).toEqual(expectedMessages);
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle loading errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        useThreadHistory({
          sessionId: mockSessionId,
          apiBaseUrl: mockApiBaseUrl
        })
      );

      await act(async () => {
        await result.current.loadHistory();
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('Network error');
      expect(result.current.messages).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      const { result } = renderHook(() =>
        useThreadHistory({
          sessionId: mockSessionId,
          apiBaseUrl: mockApiBaseUrl
        })
      );

      await act(async () => {
        await result.current.loadHistory();
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('Failed to load thread history: 404 Not Found');
    });
  });

  describe('Pagination', () => {
    it('should load more messages with pagination', async () => {
      const initialResponse = {
        ...mockApiResponse,
        hasMore: true,
        nextCursor: 'cursor-1'
      };

      const additionalResponse = {
        messages: [
          {
            id: 'msg-3',
            type: 'system',
            content: 'System message',
            timestamp: '2023-01-01T10:02:00Z',
            metadata: {}
          }
        ],
        hasMore: false,
        total: 3,
        nextCursor: undefined,
        prevCursor: undefined
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => initialResponse
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => additionalResponse
        });

      const { result } = renderHook(() =>
        useThreadHistory({
          sessionId: mockSessionId,
          apiBaseUrl: mockApiBaseUrl
        })
      );

      // Load initial history
      await act(async () => {
        await result.current.loadHistory();
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.hasMore).toBe(true);

      // Load more messages
      await act(async () => {
        await result.current.loadMoreMessages();
      });

      expect(mockFetch).toHaveBeenNthCalledWith(2,
        `${mockApiBaseUrl}/api/sessions/${mockSessionId}/thread?limit=50&after=cursor-1`
      );
      expect(result.current.messages).toHaveLength(3);
      expect(result.current.hasMore).toBe(false);
      expect(result.current.totalCount).toBe(3);
    });

    it('should respect custom page size', async () => {
      const { result } = renderHook(() =>
        useThreadHistory({
          sessionId: mockSessionId,
          apiBaseUrl: mockApiBaseUrl,
          pageSize: 25
        })
      );

      await act(async () => {
        await result.current.loadHistory();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockApiBaseUrl}/api/sessions/${mockSessionId}/thread?limit=25`
      );
    });
  });

  describe('Message Management', () => {
    it('should add new messages', async () => {
      const { result } = renderHook(() =>
        useThreadHistory({
          sessionId: mockSessionId,
          apiBaseUrl: mockApiBaseUrl
        })
      );

      const newMessage: ThreadMessage = {
        id: 'new-msg',
        role: 'user',
        content: 'New message',
        ts: '2023-01-01T11:00:00Z',
        metadata: {}
      };

      act(() => {
        result.current.addMessage(newMessage);
      });

      expect(result.current.messages).toContain(newMessage);
      expect(result.current.totalCount).toBe(1);
    });

    it('should add multiple messages', async () => {
      const { result } = renderHook(() =>
        useThreadHistory({
          sessionId: mockSessionId,
          apiBaseUrl: mockApiBaseUrl
        })
      );

      const newMessages: ThreadMessage[] = [
        {
          id: 'new-msg-1',
          role: 'user',
          content: 'New message 1',
          ts: '2023-01-01T11:00:00Z',
          metadata: {}
        },
        {
          id: 'new-msg-2',
          role: 'amp',
          content: 'New message 2',
          ts: '2023-01-01T11:01:00Z',
          metadata: {}
        }
      ];

      act(() => {
        result.current.addMessages(newMessages);
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.totalCount).toBe(2);
    });

    it('should sort messages by timestamp', async () => {
      const { result } = renderHook(() =>
        useThreadHistory({
          sessionId: mockSessionId,
          apiBaseUrl: mockApiBaseUrl
        })
      );

      const messagesOutOfOrder: ThreadMessage[] = [
        {
          id: 'msg-2',
          role: 'amp',
          content: 'Second message',
          ts: '2023-01-01T11:01:00Z',
          metadata: {}
        },
        {
          id: 'msg-1',
          role: 'user',
          content: 'First message',
          ts: '2023-01-01T11:00:00Z',
          metadata: {}
        }
      ];

      act(() => {
        result.current.addMessages(messagesOutOfOrder);
      });

      expect(result.current.messages[0]?.content).toBe('First message');
      expect(result.current.messages[1]?.content).toBe('Second message');
    });

    it('should prevent duplicate messages', async () => {
      const { result } = renderHook(() =>
        useThreadHistory({
          sessionId: mockSessionId,
          apiBaseUrl: mockApiBaseUrl
        })
      );

      const message: ThreadMessage = {
        id: 'duplicate-msg',
        role: 'user',
        content: 'Duplicate message',
        ts: '2023-01-01T11:00:00Z',
        metadata: {}
      };

      act(() => {
        result.current.addMessage(message);
      });

      act(() => {
        result.current.addMessage(message);
      });

      expect(result.current.messages).toHaveLength(1);
    });
  });

  describe('State Management', () => {
    it('should clear history', async () => {
      const { result } = renderHook(() =>
        useThreadHistory({
          sessionId: mockSessionId,
          apiBaseUrl: mockApiBaseUrl,
          autoLoad: true
        })
      );

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2);
      });

      act(() => {
        result.current.clearHistory();
      });

      expect(result.current.messages).toEqual([]);
      expect(result.current.hasMore).toBe(true);
      expect(result.current.totalCount).toBe(0);
      expect(result.current.error).toBeNull();
    });

    it('should refresh history', async () => {
      const { result } = renderHook(() =>
        useThreadHistory({
          sessionId: mockSessionId,
          apiBaseUrl: mockApiBaseUrl,
          autoLoad: true
        })
      );

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2);
      });

      // Add a message manually
      const newMessage: ThreadMessage = {
        id: 'manual-msg',
        role: 'user',
        content: 'Manual message',
        ts: '2023-01-01T11:00:00Z',
        metadata: {}
      };

      act(() => {
        result.current.addMessage(newMessage);
      });

      expect(result.current.messages).toHaveLength(3);

      // Refresh should reset to server state
      await act(async () => {
        await result.current.refreshHistory();
      });

      expect(result.current.messages).toHaveLength(2);
    });
  });

  describe('Role Conversion', () => {
    it('should convert user_input type to user role', () => {
      const { result } = renderHook(() =>
        useThreadHistory({
          sessionId: mockSessionId,
          apiBaseUrl: mockApiBaseUrl
        })
      );

      const apiMessage = {
        id: 'test',
        type: 'user_input',
        content: 'Test',
        timestamp: '2023-01-01T10:00:00Z',
        metadata: {}
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: [apiMessage],
          hasMore: false,
          total: 1
        })
      });

      act(() => {
        result.current.loadHistory();
      });

      waitFor(() => {
        expect(result.current.messages[0]?.role).toBe('user');
      });
    });

    it('should convert system type to system role', () => {
      const { result } = renderHook(() =>
        useThreadHistory({
          sessionId: mockSessionId,
          apiBaseUrl: mockApiBaseUrl
        })
      );

      const apiMessage = {
        id: 'test',
        type: 'system',
        content: 'Test',
        timestamp: '2023-01-01T10:00:00Z',
        metadata: {}
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: [apiMessage],
          hasMore: false,
          total: 1
        })
      });

      act(() => {
        result.current.loadHistory();
      });

      waitFor(() => {
        expect(result.current.messages[0]?.role).toBe('system');
      });
    });

    it('should convert other types to amp role', () => {
      const { result } = renderHook(() =>
        useThreadHistory({
          sessionId: mockSessionId,
          apiBaseUrl: mockApiBaseUrl
        })
      );

      const apiMessage = {
        id: 'test',
        type: 'tool_output',
        content: 'Test',
        timestamp: '2023-01-01T10:00:00Z',
        metadata: {}
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: [apiMessage],
          hasMore: false,
          total: 1
        })
      });

      act(() => {
        result.current.loadHistory();
      });

      waitFor(() => {
        expect(result.current.messages[0]?.role).toBe('amp');
      });
    });
  });

  describe('Loading States', () => {
    it('should prevent concurrent loads', async () => {
      const { result } = renderHook(() =>
        useThreadHistory({
          sessionId: mockSessionId,
          apiBaseUrl: mockApiBaseUrl
        })
      );

      // Start two loads simultaneously
      const promise1 = act(async () => {
        await result.current.loadHistory();
      });

      const promise2 = act(async () => {
        await result.current.loadHistory();
      });

      await Promise.all([promise1, promise2]);

      // Should only make one API call
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not load more if already loading', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockApiResponse,
          hasMore: true,
          nextCursor: 'cursor-1'
        })
      });

      const { result } = renderHook(() =>
        useThreadHistory({
          sessionId: mockSessionId,
          apiBaseUrl: mockApiBaseUrl,
          autoLoad: true
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Start loading more
      act(() => {
        result.current.loadMoreMessages();
      });

      // Try to load more again while still loading
      act(() => {
        result.current.loadMoreMessages();
      });

      // Should only make the initial load call plus one loadMore call
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });
  });
});
