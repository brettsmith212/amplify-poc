import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import MessageBubble from '../../../components/task/MessageBubble';
import { ThreadMessage } from '../../../types/threadMessage';

// Mock the formatting utility
vi.mock('../../../utils/messageFormatting', () => ({
  formatTimestamp: vi.fn((ts: string) => {
    // Simple mock that returns a consistent format
    return ts === '2023-01-01T12:00:00Z' ? '2h ago' : 'just now';
  }),
  getMetadataDisplay: vi.fn((metadata) => {
    if (metadata?.type === 'error') return 'Command failed with exit code 1';
    if (metadata?.type === 'file_change') return 'Modified 2 files';
    return null;
  }),
  formatFilesList: vi.fn((files) => files || [])
}));

describe('MessageBubble', () => {
  const baseMessage: ThreadMessage = {
    id: 'test-msg-1',
    role: 'user',
    content: 'Hello world',
    ts: '2023-01-01T12:00:00Z'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders user message with correct styling', () => {
      render(<MessageBubble message={baseMessage} />);
      
      expect(screen.getByText('You')).toBeInTheDocument();
      expect(screen.getByText('Hello world')).toBeInTheDocument();
      expect(screen.getByText('2h ago')).toBeInTheDocument();
    });

    it('renders amp message with correct styling', () => {
      const ampMessage: ThreadMessage = {
        ...baseMessage,
        role: 'amp'
      };
      
      render(<MessageBubble message={ampMessage} />);
      
      expect(screen.getByText('Amp')).toBeInTheDocument();
      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });

    it('renders system message with correct styling', () => {
      const systemMessage: ThreadMessage = {
        ...baseMessage,
        role: 'system'
      };
      
      render(<MessageBubble message={systemMessage} />);
      
      expect(screen.getByText('System')).toBeInTheDocument();
      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });
  });

  describe('Timestamp Formatting', () => {
    it('displays formatted timestamp', () => {
      render(<MessageBubble message={baseMessage} />);
      
      expect(screen.getByText('2h ago')).toBeInTheDocument();
    });

    it('handles different timestamp formats', () => {
      const recentMessage: ThreadMessage = {
        ...baseMessage,
        ts: '2023-01-01T12:01:00Z'
      };
      
      render(<MessageBubble message={recentMessage} />);
      
      expect(screen.getByText('just now')).toBeInTheDocument();
    });
  });

  describe('Metadata Display', () => {
    it('displays error metadata', () => {
      const errorMessage: ThreadMessage = {
        ...baseMessage,
        metadata: {
          type: 'error',
          exitCode: 1
        }
      };
      
      render(<MessageBubble message={errorMessage} />);
      
      expect(screen.getByText('Command failed with exit code 1')).toBeInTheDocument();
      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    it('displays file change metadata', () => {
      const fileChangeMessage: ThreadMessage = {
        ...baseMessage,
        metadata: {
          type: 'file_change',
          files: ['src/file1.ts', 'src/file2.ts']
        }
      };
      
      render(<MessageBubble message={fileChangeMessage} />);
      
      expect(screen.getByText('Modified 2 files')).toBeInTheDocument();
      expect(screen.getByText('Files Changed')).toBeInTheDocument();
    });

    it('displays success indicator for successful code execution', () => {
      const successMessage: ThreadMessage = {
        ...baseMessage,
        metadata: {
          type: 'code',
          exitCode: 0
        }
      };
      
      render(<MessageBubble message={successMessage} />);
      
      expect(screen.getByText('Success')).toBeInTheDocument();
    });

    it('does not display metadata when none provided', () => {
      render(<MessageBubble message={baseMessage} />);
      
      expect(screen.queryByText('Error')).not.toBeInTheDocument();
      expect(screen.queryByText('Success')).not.toBeInTheDocument();
      expect(screen.queryByText('Files Changed')).not.toBeInTheDocument();
    });
  });

  describe('Files List', () => {
    it('displays modified files list', () => {
      const fileMessage: ThreadMessage = {
        ...baseMessage,
        metadata: {
          type: 'file_change',
          files: ['src/component.tsx', 'src/utils.ts']
        }
      };
      
      render(<MessageBubble message={fileMessage} />);
      
      expect(screen.getByText('Modified Files:')).toBeInTheDocument();
      expect(screen.getByText('src/component.tsx')).toBeInTheDocument();
      expect(screen.getByText('src/utils.ts')).toBeInTheDocument();
    });

    it('does not display files section when no files', () => {
      render(<MessageBubble message={baseMessage} />);
      
      expect(screen.queryByText('Modified Files:')).not.toBeInTheDocument();
    });

    it('shows truncation message for many files', () => {
      const manyFilesMessage: ThreadMessage = {
        ...baseMessage,
        metadata: {
          type: 'file_change',
          files: Array.from({ length: 15 }, (_, i) => `file${i}.ts`)
        }
      };
      
      render(<MessageBubble message={manyFilesMessage} />);
      
      expect(screen.getByText('... and 5 more files')).toBeInTheDocument();
    });
  });

  describe('Content Rendering', () => {
    it('renders message content with MarkdownRenderer', () => {
      const multilineMessage: ThreadMessage = {
        ...baseMessage,
        content: 'Line 1\n\nLine 2\n\n  Indented line'
      };
      
      const { container } = render(<MessageBubble message={multilineMessage} />);
      
      // Check that the content is rendered (MarkdownRenderer converts newlines to paragraphs)
      expect(container.textContent).toContain('Line 1');
      expect(container.textContent).toContain('Line 2');
      expect(container.textContent).toContain('Indented line');
    });

    it('handles empty content', () => {
      const emptyMessage: ThreadMessage = {
        ...baseMessage,
        content: ''
      };
      
      render(<MessageBubble message={emptyMessage} />);
      
      expect(screen.getByText('You')).toBeInTheDocument();
      // Content area should still exist even if empty
      expect(screen.getByText('You').closest('.flex')).toBeInTheDocument();
    });
  });

  describe('Styling and Layout', () => {
    it('applies custom className', () => {
      const { container } = render(
        <MessageBubble message={baseMessage} className="custom-class" />
      );
      
      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('has proper avatar styling for user role', () => {
      const { container } = render(<MessageBubble message={baseMessage} />);
      
      const avatar = container.querySelector('.bg-blue-600');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveClass('w-8', 'h-8', 'rounded-full');
    });

    it('has proper avatar styling for amp role', () => {
      const ampMessage: ThreadMessage = {
        ...baseMessage,
        role: 'amp'
      };
      
      const { container } = render(<MessageBubble message={ampMessage} />);
      
      const avatar = container.querySelector('.bg-gradient-to-br');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveClass('from-emerald-500', 'to-emerald-600');
    });

    it('has proper bubble styling', () => {
      const { container } = render(<MessageBubble message={baseMessage} />);
      
      const bubble = container.querySelector('.rounded-lg.p-3');
      expect(bubble).toBeInTheDocument();
      expect(bubble).toHaveClass('max-w-4xl', 'shadow-sm', 'border');
    });
  });

  describe('Accessibility', () => {
    it('has proper structure for screen readers', () => {
      const { container } = render(<MessageBubble message={baseMessage} />);
      
      // Check that the message has a clear structure
      const messageContainer = container.firstChild;
      expect(messageContainer).toHaveClass('flex', 'space-x-3');
      
      // Check that avatar and content are separate
      const avatar = container.querySelector('.flex-shrink-0');
      const content = container.querySelector('.flex-1');
      expect(avatar).toBeInTheDocument();
      expect(content).toBeInTheDocument();
    });

    it('provides meaningful text content', () => {
      render(<MessageBubble message={baseMessage} />);
      
      // All essential information should be present as text
      expect(screen.getByText('You')).toBeInTheDocument();
      expect(screen.getByText('Hello world')).toBeInTheDocument();
      expect(screen.getByText('2h ago')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles very long content', () => {
      const longMessage: ThreadMessage = {
        ...baseMessage,
        content: 'A'.repeat(1000)
      };
      
      render(<MessageBubble message={longMessage} />);
      
      expect(screen.getByText('A'.repeat(1000))).toBeInTheDocument();
    });

    it('handles special characters in content', () => {
      const specialMessage: ThreadMessage = {
        ...baseMessage,
        content: 'Special chars: <>&"\'`'
      };
      
      render(<MessageBubble message={specialMessage} />);
      
      expect(screen.getByText('Special chars: <>&"\'`')).toBeInTheDocument();
    });

    it('handles undefined metadata gracefully', () => {
      const { metadata, ...messageWithoutMetadata } = baseMessage;
      const messageWithUndefinedMetadata: ThreadMessage = messageWithoutMetadata;
      
      render(<MessageBubble message={messageWithUndefinedMetadata} />);
      
      expect(screen.getByText('You')).toBeInTheDocument();
      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });
  });
});
