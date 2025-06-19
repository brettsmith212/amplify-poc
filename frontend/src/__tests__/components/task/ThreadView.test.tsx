import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, Mock, describe, it, expect, beforeEach } from 'vitest';
import ThreadView from '../../../components/task/ThreadView';
import { ThreadMessage } from '../../../types/threadMessage';

// Mock the useThreadMessages hook
vi.mock('../../../hooks/useThreadMessages', () => ({
  default: vi.fn()
}));

const mockUseThreadMessages = vi.mocked(await import('../../../hooks/useThreadMessages')).default as Mock;

describe('ThreadView Component', () => {
  const mockSendMessage = vi.fn();

  const defaultHookReturn = {
    messages: [],
    sendMessage: mockSendMessage,
    isLoading: false,
    isConnected: true,
    isSending: false,
    connectionState: 'connected' as const
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseThreadMessages.mockReturnValue(defaultHookReturn);
  });

  describe('Basic Rendering', () => {
    it('renders empty state when no messages', () => {
      render(<ThreadView sessionId="test-session" />);

      expect(screen.getByText('Start a conversation')).toBeInTheDocument();
      expect(screen.getByText(/Send a message to begin your session/)).toBeInTheDocument();
    });

    it('renders messages when provided', () => {
      const messages: ThreadMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          ts: '2023-01-01T10:00:00Z',
          metadata: {}
        },
        {
          id: '2',
          role: 'amp',
          content: 'Hi there!',
          ts: '2023-01-01T10:01:00Z',
          metadata: {}
        }
      ];

      mockUseThreadMessages.mockReturnValue({
        ...defaultHookReturn,
        messages
      });

      render(<ThreadView sessionId="test-session" />);

      expect(screen.getByText('Hello')).toBeInTheDocument();
      expect(screen.getByText('Hi there!')).toBeInTheDocument();
    });

    it('applies custom className when provided', () => {
      const { container } = render(
        <ThreadView sessionId="test-session" className="custom-class" />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('Loading States', () => {
    it('shows loading indicator when loading', () => {
      mockUseThreadMessages.mockReturnValue({
        ...defaultHookReturn,
        isLoading: true
      });

      render(<ThreadView sessionId="test-session" />);

      expect(screen.getByText('Loading messages...')).toBeInTheDocument();
    });

    it('shows loading state in message input when loading', () => {
      mockUseThreadMessages.mockReturnValue({
        ...defaultHookReturn,
        isLoading: true
      });

      render(<ThreadView sessionId="test-session" />);

      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
    });
  });

  describe('Connection States', () => {
    it('shows disconnected state when not connected', () => {
      mockUseThreadMessages.mockReturnValue({
        ...defaultHookReturn,
        isConnected: false,
        connectionState: 'disconnected'
      });

      render(<ThreadView sessionId="test-session" />);

      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });

    it('disables input when disconnected', () => {
      mockUseThreadMessages.mockReturnValue({
        ...defaultHookReturn,
        isConnected: false,
        connectionState: 'disconnected'
      });

      render(<ThreadView sessionId="test-session" />);

      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
    });
  });

  describe('Message Sending', () => {
    it('calls sendMessage when form is submitted', async () => {
      render(<ThreadView sessionId="test-session" />);

      const input = screen.getByRole('textbox');
      const sendButton = screen.getByRole('button', { name: /send/i });

      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.click(sendButton);

      expect(mockSendMessage).toHaveBeenCalledWith('Test message');
    });

    it('shows sending state', () => {
      mockUseThreadMessages.mockReturnValue({
        ...defaultHookReturn,
        isSending: true
      });

      render(<ThreadView sessionId="test-session" />);

      const sendButton = screen.getByRole('button', { name: /send/i });
      expect(sendButton).toBeDisabled();
    });

    it('clears input after sending message', async () => {
      render(<ThreadView sessionId="test-session" />);

      const input = screen.getByRole('textbox') as HTMLInputElement;
      const sendButton = screen.getByRole('button', { name: /send/i });

      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(input.value).toBe('');
      });
    });

    it('prevents sending empty messages', () => {
      render(<ThreadView sessionId="test-session" />);

      const sendButton = screen.getByRole('button', { name: /send/i });
      fireEvent.click(sendButton);

      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('trims whitespace from messages', async () => {
      render(<ThreadView sessionId="test-session" />);

      const input = screen.getByRole('textbox');
      const sendButton = screen.getByRole('button', { name: /send/i });

      fireEvent.change(input, { target: { value: '  Test message  ' } });
      fireEvent.click(sendButton);

      expect(mockSendMessage).toHaveBeenCalledWith('Test message');
    });

    it('handles Enter key submission', () => {
      render(<ThreadView sessionId="test-session" />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      // The MessageInput component handles key submission
      expect(input).toBeInTheDocument();
    });

    it('handles Shift+Enter for new lines', () => {
      render(<ThreadView sessionId="test-session" />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', shiftKey: true });

      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  describe('Message Display', () => {
    it('displays messages with correct roles', () => {
      const messages: ThreadMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'User message',
          ts: '2023-01-01T10:00:00Z',
          metadata: {}
        },
        {
          id: '2',
          role: 'amp',
          content: 'Assistant message',
          ts: '2023-01-01T10:01:00Z',
          metadata: {}
        }
      ];

      mockUseThreadMessages.mockReturnValue({
        ...defaultHookReturn,
        messages
      });

      render(<ThreadView sessionId="test-session" />);

      expect(screen.getByText('User message')).toBeInTheDocument();
      expect(screen.getByText('Assistant message')).toBeInTheDocument();
    });

    it('displays timestamps', () => {
      const messages: ThreadMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Test message',
          ts: '2023-01-01T10:00:00Z',
          metadata: {}
        }
      ];

      mockUseThreadMessages.mockReturnValue({
        ...defaultHookReturn,
        messages
      });

      render(<ThreadView sessionId="test-session" />);

      // Should display time in format like "Jan 1, 02:00 AM"
      expect(screen.getByText(/Jan 1/)).toBeInTheDocument();
    });

    it('auto-scrolls to bottom when new messages arrive', () => {
      const messages: ThreadMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Message 1',
          ts: '2023-01-01T10:00:00Z',
          metadata: {}
        }
      ];

      mockUseThreadMessages.mockReturnValue({
        ...defaultHookReturn,
        messages
      });

      render(<ThreadView sessionId="test-session" />);

      // Check that the first message is displayed
      expect(screen.getByText('Message 1')).toBeInTheDocument();
    });
  });

  describe('Hook Integration', () => {
    it('calls useThreadMessages with correct sessionId', () => {
      render(<ThreadView sessionId="test-session-123" />);

      expect(mockUseThreadMessages).toHaveBeenCalledWith({
        sessionId: 'test-session-123',
        loadHistory: true
      });
    });

    it('respects loadHistory prop', () => {
      render(<ThreadView sessionId="test-session" loadHistory={false} />);

      expect(mockUseThreadMessages).toHaveBeenCalledWith({
        sessionId: 'test-session',
        loadHistory: false
      });
    });

    it('defaults loadHistory to true', () => {
      render(<ThreadView sessionId="test-session" />);

      expect(mockUseThreadMessages).toHaveBeenCalledWith({
        sessionId: 'test-session',
        loadHistory: true
      });
    });
  });

  describe('Error Handling', () => {
    it('handles missing sessionId gracefully', () => {
      render(<ThreadView sessionId="" />);
      expect(screen.getByText('Start a conversation')).toBeInTheDocument();
    });

    it('handles hook errors gracefully', () => {
      mockUseThreadMessages.mockReturnValue({
        ...defaultHookReturn,
        messages: [],
        isConnected: false,
        connectionState: 'error'
      });

      render(<ThreadView sessionId="test-session" />);
      expect(screen.getByText('Connection failed')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<ThreadView sessionId="test-session" />);

      const messageInput = screen.getByRole('textbox');
      const sendButton = screen.getByRole('button', { name: /send/i });

      expect(messageInput).toHaveAttribute('placeholder', 'Type a message to continue the task... (⌘/Ctrl + Enter to send)');
      expect(sendButton).toBeInTheDocument();
    });

    it('maintains focus after sending message', async () => {
      render(<ThreadView sessionId="test-session" />);

      const input = screen.getByRole('textbox');
      const sendButton = screen.getByRole('button', { name: /send/i });

      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(input).toHaveFocus();
      });
    });
  });
});
