import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ThreadView from '../../../components/task/ThreadView';
import { ThreadMessage } from '../../../types/threadMessage';

// Mock the auto-scroll hook
vi.mock('../../../hooks/useAutoScroll', () => ({
  default: vi.fn(() => ({
    scrollRef: { current: null },
    scrollToBottom: vi.fn(),
    isAtBottom: vi.fn(() => true)
  }))
}));

// Mock MessageBubble component
vi.mock('../../../components/task/MessageBubble', () => ({
  default: ({ message }: { message: ThreadMessage }) => (
    <div data-testid={`message-${message.id}`}>
      <span>{message.role}: {message.content}</span>
    </div>
  )
}));

describe('ThreadView', () => {
  const mockOnSendMessage = vi.fn();
  
  const sampleMessages: ThreadMessage[] = [
    {
      id: 'msg-1',
      role: 'user',
      content: 'Hello, world!',
      ts: '2023-01-01T12:00:00Z'
    },
    {
      id: 'msg-2',
      role: 'amp',
      content: 'Hello! How can I help you today?',
      ts: '2023-01-01T12:01:00Z'
    }
  ];

  beforeEach(() => {
    mockOnSendMessage.mockClear();
  });

  describe('Basic Rendering', () => {
    it('renders empty state when no messages', () => {
      render(
        <ThreadView
          sessionId="test-session"
          messages={[]}
          onSendMessage={mockOnSendMessage}
        />
      );

      expect(screen.getByText('Start a conversation')).toBeInTheDocument();
      expect(screen.getByText(/Send a message to begin your session/)).toBeInTheDocument();
    });

    it('renders messages when provided', () => {
      render(
        <ThreadView
          sessionId="test-session"
          messages={sampleMessages}
          onSendMessage={mockOnSendMessage}
        />
      );

      expect(screen.getByTestId('message-msg-1')).toBeInTheDocument();
      expect(screen.getByTestId('message-msg-2')).toBeInTheDocument();
      expect(screen.getByText('user: Hello, world!')).toBeInTheDocument();
      expect(screen.getByText('amp: Hello! How can I help you today?')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <ThreadView
          sessionId="test-session"
          messages={[]}
          className="custom-class"
          onSendMessage={mockOnSendMessage}
        />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('Loading States', () => {
    it('shows loading spinner when isLoading is true', () => {
      render(
        <ThreadView
          sessionId="test-session"
          messages={[]}
          isLoading={true}
          onSendMessage={mockOnSendMessage}
        />
      );

      expect(screen.getByText('Loading messages...')).toBeInTheDocument();
      expect(screen.queryByText('Start a conversation')).not.toBeInTheDocument();
    });

    it('hides loading spinner when isLoading is false', () => {
      render(
        <ThreadView
          sessionId="test-session"
          messages={[]}
          isLoading={false}
          onSendMessage={mockOnSendMessage}
        />
      );

      expect(screen.queryByText('Loading messages...')).not.toBeInTheDocument();
      expect(screen.getByText('Start a conversation')).toBeInTheDocument();
    });
  });

  describe('Connection Status', () => {
    it('shows connection status when not connected', () => {
      render(
        <ThreadView
          sessionId="test-session"
          messages={[]}
          isConnected={false}
          onSendMessage={mockOnSendMessage}
        />
      );

      expect(screen.getByText('Connecting to session...')).toBeInTheDocument();
    });

    it('hides connection status when connected', () => {
      render(
        <ThreadView
          sessionId="test-session"
          messages={[]}
          isConnected={true}
          onSendMessage={mockOnSendMessage}
        />
      );

      expect(screen.queryByText('Connecting to session...')).not.toBeInTheDocument();
    });
  });

  describe('Message Input', () => {
    it('renders message input area', () => {
      render(
        <ThreadView
          sessionId="test-session"
          messages={[]}
          onSendMessage={mockOnSendMessage}
        />
      );

      expect(screen.getByPlaceholderText(/Type a message to continue/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Send message/ })).toBeInTheDocument();
    });

    it('disables input when not connected', () => {
      render(
        <ThreadView
          sessionId="test-session"
          messages={[]}
          isConnected={false}
          onSendMessage={mockOnSendMessage}
        />
      );

      const textarea = screen.getByPlaceholderText(/Type a message to continue/);
      const sendButton = screen.getByRole('button', { name: /Send message/ });

      expect(textarea).toBeDisabled();
      expect(sendButton).toBeDisabled();
    });

    it('disables input when loading', () => {
      render(
        <ThreadView
          sessionId="test-session"
          messages={[]}
          isLoading={true}
          onSendMessage={mockOnSendMessage}
        />
      );

      const textarea = screen.getByPlaceholderText(/Type a message to continue/);
      const sendButton = screen.getByRole('button', { name: /Send message/ });

      expect(textarea).toBeDisabled();
      expect(sendButton).toBeDisabled();
    });

    it('enables input when connected and not loading', () => {
      render(
        <ThreadView
          sessionId="test-session"
          messages={[]}
          isConnected={true}
          isLoading={false}
          onSendMessage={mockOnSendMessage}
        />
      );

      const textarea = screen.getByPlaceholderText(/Type a message to continue/);
      const sendButton = screen.getByRole('button', { name: /Send message/ });

      expect(textarea).not.toBeDisabled();
      expect(sendButton).toBeDisabled(); // Disabled because no text
    });
  });

  describe('Message Sending', () => {
    it('enables send button when text is entered', () => {
      render(
        <ThreadView
          sessionId="test-session"
          messages={[]}
          onSendMessage={mockOnSendMessage}
        />
      );

      const textarea = screen.getByPlaceholderText(/Type a message to continue/);
      const sendButton = screen.getByRole('button', { name: /Send message/ });

      expect(sendButton).toBeDisabled();

      fireEvent.change(textarea, { target: { value: 'Hello' } });
      expect(sendButton).not.toBeDisabled();
    });

    it('calls onSendMessage when send button is clicked', () => {
      render(
        <ThreadView
          sessionId="test-session"
          messages={[]}
          onSendMessage={mockOnSendMessage}
        />
      );

      const textarea = screen.getByPlaceholderText(/Type a message to continue/);
      const sendButton = screen.getByRole('button', { name: /Send message/ });

      fireEvent.change(textarea, { target: { value: 'Test message' } });
      fireEvent.click(sendButton);

      expect(mockOnSendMessage).toHaveBeenCalledWith('Test message');
    });

    it('calls onSendMessage when Cmd+Enter is pressed', () => {
      render(
        <ThreadView
          sessionId="test-session"
          messages={[]}
          onSendMessage={mockOnSendMessage}
        />
      );

      const textarea = screen.getByPlaceholderText(/Type a message to continue/);

      fireEvent.change(textarea, { target: { value: 'Test message' } });
      fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });

      expect(mockOnSendMessage).toHaveBeenCalledWith('Test message');
    });

    it('calls onSendMessage when Ctrl+Enter is pressed', () => {
      render(
        <ThreadView
          sessionId="test-session"
          messages={[]}
          onSendMessage={mockOnSendMessage}
        />
      );

      const textarea = screen.getByPlaceholderText(/Type a message to continue/);

      fireEvent.change(textarea, { target: { value: 'Test message' } });
      fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });

      expect(mockOnSendMessage).toHaveBeenCalledWith('Test message');
    });

    it('does not call onSendMessage when Enter is pressed without modifier', () => {
      render(
        <ThreadView
          sessionId="test-session"
          messages={[]}
          onSendMessage={mockOnSendMessage}
        />
      );

      const textarea = screen.getByPlaceholderText(/Type a message to continue/);

      fireEvent.change(textarea, { target: { value: 'Test message' } });
      fireEvent.keyDown(textarea, { key: 'Enter' });

      expect(mockOnSendMessage).not.toHaveBeenCalled();
    });

    it('clears input after sending message', () => {
      render(
        <ThreadView
          sessionId="test-session"
          messages={[]}
          onSendMessage={mockOnSendMessage}
        />
      );

      const textarea = screen.getByPlaceholderText(/Type a message to continue/) as HTMLTextAreaElement;
      const sendButton = screen.getByRole('button', { name: /Send message/ });

      fireEvent.change(textarea, { target: { value: 'Test message' } });
      expect(textarea.value).toBe('Test message');

      fireEvent.click(sendButton);

      expect(textarea.value).toBe('');
    });

    it('trims whitespace from messages', () => {
      render(
        <ThreadView
          sessionId="test-session"
          messages={[]}
          onSendMessage={mockOnSendMessage}
        />
      );

      const textarea = screen.getByPlaceholderText(/Type a message to continue/);
      const sendButton = screen.getByRole('button', { name: /Send message/ });

      fireEvent.change(textarea, { target: { value: '  Test message  ' } });
      fireEvent.click(sendButton);

      expect(mockOnSendMessage).toHaveBeenCalledWith('Test message');
    });

    it('does not send empty or whitespace-only messages', () => {
      render(
        <ThreadView
          sessionId="test-session"
          messages={[]}
          onSendMessage={mockOnSendMessage}
        />
      );

      const textarea = screen.getByPlaceholderText(/Type a message to continue/);
      const sendButton = screen.getByRole('button', { name: /Send message/ });

      fireEvent.change(textarea, { target: { value: '   ' } });
      fireEvent.click(sendButton);

      expect(mockOnSendMessage).not.toHaveBeenCalled();
    });
  });

  describe('Sending State', () => {
    it('disables input and shows spinner when sending', () => {
      render(
        <ThreadView
          sessionId="test-session"
          messages={[]}
          isSending={true}
          onSendMessage={mockOnSendMessage}
        />
      );

      const textarea = screen.getByPlaceholderText(/Type a message to continue/);
      const sendButton = screen.getByRole('button', { name: /Sending message/ });

      expect(textarea).toBeDisabled();
      expect(sendButton).toBeDisabled();
    });

    it('prevents sending when already sending', () => {
      render(
        <ThreadView
          sessionId="test-session"
          messages={[]}
          isSending={true}
          onSendMessage={mockOnSendMessage}
        />
      );

      const textarea = screen.getByPlaceholderText(/Type a message to continue/);

      fireEvent.change(textarea, { target: { value: 'Test message' } });
      fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });

      expect(mockOnSendMessage).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for send button', () => {
      render(
        <ThreadView
          sessionId="test-session"
          messages={[]}
          onSendMessage={mockOnSendMessage}
        />
      );

      const sendButton = screen.getByRole('button', { name: /Send message/ });
      expect(sendButton).toHaveAttribute('aria-label', 'Send message');
    });

    it('updates ARIA label when sending', () => {
      render(
        <ThreadView
          sessionId="test-session"
          messages={[]}
          isSending={true}
          onSendMessage={mockOnSendMessage}
        />
      );

      const sendButton = screen.getByRole('button', { name: /Sending message/ });
      expect(sendButton).toHaveAttribute('aria-label', 'Sending message');
    });

    it('provides helpful placeholder text', () => {
      render(
        <ThreadView
          sessionId="test-session"
          messages={[]}
          onSendMessage={mockOnSendMessage}
        />
      );

      expect(screen.getByPlaceholderText(/Type a message to continue the task.../)).toBeInTheDocument();
    });

    it('shows keyboard shortcut hint', () => {
      render(
        <ThreadView
          sessionId="test-session"
          messages={[]}
          onSendMessage={mockOnSendMessage}
        />
      );

      expect(screen.getByText(/Press ⌘\/Ctrl \+ Enter to send/)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles missing onSendMessage prop gracefully', () => {
      render(
        <ThreadView
          sessionId="test-session"
          messages={[]}
        />
      );

      const textarea = screen.getByPlaceholderText(/Type a message to continue/);
      const sendButton = screen.getByRole('button', { name: /Send message/ });

      fireEvent.change(textarea, { target: { value: 'Test message' } });
      fireEvent.click(sendButton);

      // Should not crash
      expect(screen.getByDisplayValue('Test message')).toBeInTheDocument();
    });

    it('handles very long messages', () => {
      const longMessage = 'A'.repeat(1000);
      
      render(
        <ThreadView
          sessionId="test-session"
          messages={[]}
          onSendMessage={mockOnSendMessage}
        />
      );

      const textarea = screen.getByPlaceholderText(/Type a message to continue/);
      const sendButton = screen.getByRole('button', { name: /Send message/ });

      fireEvent.change(textarea, { target: { value: longMessage } });
      fireEvent.click(sendButton);

      expect(mockOnSendMessage).toHaveBeenCalledWith(longMessage);
    });

    it('handles rapid state changes', () => {
      const { rerender } = render(
        <ThreadView
          sessionId="test-session"
          messages={[]}
          isConnected={false}
          isLoading={true}
          onSendMessage={mockOnSendMessage}
        />
      );

      expect(screen.getByText('Loading messages...')).toBeInTheDocument();
      expect(screen.getByText('Connecting to session...')).toBeInTheDocument();

      rerender(
        <ThreadView
          sessionId="test-session"
          messages={sampleMessages}
          isConnected={true}
          isLoading={false}
          onSendMessage={mockOnSendMessage}
        />
      );

      expect(screen.queryByText('Loading messages...')).not.toBeInTheDocument();
      expect(screen.queryByText('Connecting to session...')).not.toBeInTheDocument();
      expect(screen.getByTestId('message-msg-1')).toBeInTheDocument();
    });
  });
});
