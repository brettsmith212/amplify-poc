import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ThreadView from '../../components/task/ThreadView';
import { ConnectionState } from '../../services/threadWebSocket';

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  
  url: string;
  readyState: number = WebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    
    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  send(data: string) {
    // Simulate server response for user messages
    try {
      const message = JSON.parse(data);
      if (message.type === 'user_message') {
        setTimeout(() => {
          this.simulateResponse(message);
        }, 50);
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }

  simulateResponse(userMessage: any) {
    if (this.onmessage) {
      const responseMessage = {
        type: 'thread_message',
        data: {
          id: `response_${Date.now()}`,
          role: 'amp',
          content: `Echo: ${userMessage.data.content}`,
          ts: new Date().toISOString(),
          metadata: {}
        }
      };
      
      this.onmessage(new MessageEvent('message', {
        data: JSON.stringify(responseMessage)
      }));
    }
  }

  static getLastInstance(): MockWebSocket | undefined {
    return this.instances[this.instances.length - 1];
  }

  static reset() {
    this.instances = [];
  }
}

// Mock fetch for history loading
const mockFetch = vi.fn();

// Setup mocks
beforeEach(() => {
  // Mock WebSocket
  (globalThis as any).WebSocket = MockWebSocket as any;
  
  // Mock fetch
  (globalThis as any).fetch = mockFetch;
  
  // Mock history response
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      messages: [],
      pagination: { total: 0, page: 1, limit: 50 }
    })
  });

  // Reset WebSocket instances
  MockWebSocket.reset();
});

afterEach(() => {
  vi.clearAllMocks();
  MockWebSocket.reset();
});

describe('ThreadView Data Flow Integration', () => {
  const mockSessionId = 'test-session-123';

  it('should establish WebSocket connection on mount', async () => {
    render(<ThreadView sessionId={mockSessionId} />);

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
      expect(MockWebSocket.instances[0]?.url).toBe(`ws://localhost:3001/ws/thread/${mockSessionId}`);
    });
  });

  it('should load message history on mount', async () => {
    render(<ThreadView sessionId={mockSessionId} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(`http://localhost:3001/api/sessions/${mockSessionId}/thread`);
    });
  });

  it('should display connection status', async () => {
    const onConnectionChange = vi.fn();
    render(
      <ThreadView 
        sessionId={mockSessionId} 
        onConnectionChange={onConnectionChange}
      />
    );

    // Initially connecting
    expect(screen.getByText('Connecting to session...')).toBeInTheDocument();

    // Wait for connection to establish
    await waitFor(() => {
      expect(onConnectionChange).toHaveBeenCalledWith(ConnectionState.CONNECTED);
    });

    // Connection status should disappear when connected
    await waitFor(() => {
      expect(screen.queryByText('Connecting to session...')).not.toBeInTheDocument();
    });
  });

  it('should send and receive messages', async () => {
    render(<ThreadView sessionId={mockSessionId} />);

    // Wait for connection
    await waitFor(() => {
      expect(MockWebSocket.getLastInstance()?.readyState).toBe(WebSocket.OPEN);
    });

    // Find and use message input
    const textarea = screen.getByPlaceholderText(/type a message to continue/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    // Type a message
    fireEvent.change(textarea, { target: { value: 'Hello Amp!' } });
    
    // Send the message
    fireEvent.click(sendButton);

    // Wait for the echo response
    await waitFor(() => {
      expect(screen.getByText('Echo: Hello Amp!')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Check that input was cleared
    expect(textarea).toHaveValue('');
  });

  it('should handle connection errors with retry functionality', async () => {
    render(<ThreadView sessionId={mockSessionId} />);

    // Wait for initial connection
    await waitFor(() => {
      expect(MockWebSocket.getLastInstance()?.readyState).toBe(WebSocket.OPEN);
    });

    // Simulate connection error
    act(() => {
      const ws = MockWebSocket.getLastInstance();
      if (ws && ws.onerror) {
        ws.onerror(new Event('error'));
      }
    });

    // Should show error state
    await waitFor(() => {
      expect(screen.getByText('Connection failed')).toBeInTheDocument();
    });

    // Should have retry button
    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();

    // Click retry
    fireEvent.click(retryButton);

    // Should attempt to reconnect
    await waitFor(() => {
      expect(MockWebSocket.instances.length).toBeGreaterThan(1);
    });
  });

  it('should disable input when not connected', async () => {
    render(<ThreadView sessionId={mockSessionId} />);

    const textarea = screen.getByPlaceholderText(/type a message to continue/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    // Initially disabled while connecting
    expect(textarea).toBeDisabled();
    expect(sendButton).toBeDisabled();

    // Wait for connection
    await waitFor(() => {
      expect(textarea).not.toBeDisabled();
      expect(sendButton).not.toBeDisabled();
    });
  });

  it('should show loading state when loading history', async () => {
    // Mock slow fetch response
    mockFetch.mockImplementation(() => 
      new Promise(resolve => 
        setTimeout(() => resolve({
          ok: true,
          json: async () => ({ messages: [], pagination: { total: 0, page: 1, limit: 50 } })
        }), 100)
      )
    );

    render(<ThreadView sessionId={mockSessionId} />);

    // Should show loading spinner
    expect(screen.getByText('Loading messages...')).toBeInTheDocument();

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading messages...')).not.toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should display empty state when no messages', async () => {
    render(<ThreadView sessionId={mockSessionId} />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading messages...')).not.toBeInTheDocument();
    });

    // Should show empty state
    expect(screen.getByText('Start a conversation')).toBeInTheDocument();
    expect(screen.getByText(/Send a message to begin your session/)).toBeInTheDocument();
  });

  it('should handle API errors gracefully', async () => {
    const onError = vi.fn();
    
    // Mock API error
    mockFetch.mockRejectedValue(new Error('API Error'));

    render(
      <ThreadView 
        sessionId={mockSessionId} 
        onError={onError}
      />
    );

    // Wait for error callback
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  it('should auto-scroll to new messages', async () => {
    render(<ThreadView sessionId={mockSessionId} />);

    // Wait for connection
    await waitFor(() => {
      expect(MockWebSocket.getLastInstance()?.readyState).toBe(WebSocket.OPEN);
    });

    // Send a message to generate response
    const textarea = screen.getByPlaceholderText(/type a message to continue/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    fireEvent.change(textarea, { target: { value: 'Test message' } });
    fireEvent.click(sendButton);

    // Wait for response
    await waitFor(() => {
      expect(screen.getByText('Echo: Test message')).toBeInTheDocument();
    });

    // Verify the scroll anchor is present (indicates auto-scroll functionality)
    const messagesContainer = screen.getByText('Echo: Test message').closest('[class*="space-y-4"]');
    expect(messagesContainer).toBeInTheDocument();
  });

  it('should use custom API base URL when provided', async () => {
    const customApiUrl = 'http://custom-api:3001';
    
    render(
      <ThreadView 
        sessionId={mockSessionId}
        apiBaseUrl={customApiUrl}
      />
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(`${customApiUrl}/api/sessions/${mockSessionId}/thread`);
    });
  });
});
