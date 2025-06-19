import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MessageInput } from '../../../components/task/MessageInput';

describe('MessageInput', () => {
  const mockOnSendMessage = vi.fn();

  beforeEach(() => {
    mockOnSendMessage.mockClear();
  });

  it('renders correctly with default props', () => {
    render(<MessageInput />);
    
    expect(screen.getByLabelText('Message input')).toBeInTheDocument();
    expect(screen.getByLabelText('Send message')).toBeInTheDocument();
    expect(screen.getByText('Press ⌘/Ctrl + Enter to send')).toBeInTheDocument();
  });

  it('renders with custom placeholder', () => {
    const customPlaceholder = 'Enter your message here...';
    render(<MessageInput placeholder={customPlaceholder} />);
    
    expect(screen.getByPlaceholderText(customPlaceholder)).toBeInTheDocument();
  });

  it('hides keyboard shortcut hint when showHint is false', () => {
    render(<MessageInput showHint={false} />);
    
    expect(screen.queryByText('Press ⌘/Ctrl + Enter to send')).not.toBeInTheDocument();
  });

  it('calls onSendMessage when send button is clicked', async () => {
    const user = userEvent.setup();
    render(<MessageInput onSendMessage={mockOnSendMessage} />);
    
    const textarea = screen.getByLabelText('Message input');
    const sendButton = screen.getByLabelText('Send message');
    
    await user.type(textarea, 'Hello world');
    await user.click(sendButton);
    
    expect(mockOnSendMessage).toHaveBeenCalledWith('Hello world');
  });

  it('calls onSendMessage when Ctrl+Enter is pressed', async () => {
    const user = userEvent.setup();
    render(<MessageInput onSendMessage={mockOnSendMessage} />);
    
    const textarea = screen.getByLabelText('Message input');
    
    await user.type(textarea, 'Hello world');
    await user.keyboard('{Control>}{Enter}{/Control}');
    
    expect(mockOnSendMessage).toHaveBeenCalledWith('Hello world');
  });

  it('calls onSendMessage when Cmd+Enter is pressed', async () => {
    const user = userEvent.setup();
    render(<MessageInput onSendMessage={mockOnSendMessage} />);
    
    const textarea = screen.getByLabelText('Message input');
    
    await user.type(textarea, 'Hello world');
    await user.keyboard('{Meta>}{Enter}{/Meta}');
    
    expect(mockOnSendMessage).toHaveBeenCalledWith('Hello world');
  });

  it('clears input after sending message', async () => {
    const user = userEvent.setup();
    render(<MessageInput onSendMessage={mockOnSendMessage} />);
    
    const textarea = screen.getByLabelText('Message input');
    const sendButton = screen.getByLabelText('Send message');
    
    await user.type(textarea, 'Hello world');
    await user.click(sendButton);
    
    expect(textarea).toHaveValue('');
  });

  it('trims whitespace before sending', async () => {
    const user = userEvent.setup();
    render(<MessageInput onSendMessage={mockOnSendMessage} />);
    
    const textarea = screen.getByLabelText('Message input');
    const sendButton = screen.getByLabelText('Send message');
    
    await user.type(textarea, '  Hello world  ');
    await user.click(sendButton);
    
    expect(mockOnSendMessage).toHaveBeenCalledWith('Hello world');
  });

  it('does not send empty or whitespace-only messages', async () => {
    const user = userEvent.setup();
    render(<MessageInput onSendMessage={mockOnSendMessage} />);
    
    const textarea = screen.getByLabelText('Message input');
    const sendButton = screen.getByLabelText('Send message');
    
    // Try empty message
    await user.click(sendButton);
    expect(mockOnSendMessage).not.toHaveBeenCalled();
    
    // Try whitespace-only message
    await user.type(textarea, '   ');
    await user.click(sendButton);
    expect(mockOnSendMessage).not.toHaveBeenCalled();
  });

  it('disables input and button when disabled prop is true', () => {
    render(<MessageInput disabled={true} />);
    
    const textarea = screen.getByLabelText('Message input');
    const sendButton = screen.getByLabelText('Send message');
    
    expect(textarea).toBeDisabled();
    expect(sendButton).toBeDisabled();
  });

  it('disables input and button when isSending is true', () => {
    render(<MessageInput isSending={true} />);
    
    const textarea = screen.getByLabelText('Message input');
    const sendButton = screen.getByLabelText('Sending message');
    
    expect(textarea).toBeDisabled();
    expect(sendButton).toBeDisabled();
  });

  it('shows loading spinner when isSending is true', () => {
    render(<MessageInput isSending={true} />);
    
    const sendButton = screen.getByLabelText('Sending message');
    const spinner = sendButton.querySelector('.animate-spin');
    
    expect(spinner).toBeInTheDocument();
  });

  it('auto-resizes textarea based on content', async () => {
    const user = userEvent.setup();
    render(<MessageInput />);
    
    const textarea = screen.getByLabelText('Message input') as HTMLTextAreaElement;
    
    // Type a message with line breaks to trigger height adjustment
    await user.type(textarea, 'Line 1\nLine 2\nLine 3');
    
    // The textarea should have some height value set
    expect(textarea.style.height).not.toBe('');
  });

  it('applies custom className', () => {
    const customClass = 'custom-test-class';
    const { container } = render(<MessageInput className={customClass} />);
    
    // The custom class should be applied to the root container
    const rootElement = container.firstChild as HTMLElement;
    expect(rootElement).toHaveClass(customClass);
  });

  it('does not auto-focus when autoFocus is false', () => {
    render(<MessageInput autoFocus={false} />);
    
    const textarea = screen.getByLabelText('Message input');
    expect(textarea).not.toHaveFocus();
  });

  it('auto-focuses by default', () => {
    render(<MessageInput />);
    
    const textarea = screen.getByLabelText('Message input');
    expect(textarea).toHaveFocus();
  });

  it('handles Enter key without modifiers correctly', async () => {
    const user = userEvent.setup();
    render(<MessageInput onSendMessage={mockOnSendMessage} />);
    
    const textarea = screen.getByLabelText('Message input');
    
    await user.type(textarea, 'Hello world');
    await user.keyboard('{Enter}');
    
    // Should not send message, only add new line
    expect(mockOnSendMessage).not.toHaveBeenCalled();
    expect(textarea).toHaveValue('Hello world\n');
  });

  it('shows correct button states', async () => {
    const user = userEvent.setup();
    render(<MessageInput onSendMessage={mockOnSendMessage} />);
    
    const textarea = screen.getByLabelText('Message input');
    const sendButton = screen.getByLabelText('Send message');
    
    // Initially disabled (empty message)
    expect(sendButton).toHaveClass('cursor-not-allowed');
    
    // Enabled when message is typed
    await user.type(textarea, 'Hello');
    expect(sendButton).not.toHaveClass('cursor-not-allowed');
  });
});
