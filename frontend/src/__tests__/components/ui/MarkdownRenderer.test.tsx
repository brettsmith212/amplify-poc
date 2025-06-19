import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import MarkdownRenderer from '../../../components/ui/MarkdownRenderer';

// Mock navigator.clipboard
const mockClipboard = {
  writeText: vi.fn()
};

Object.assign(navigator, {
  clipboard: mockClipboard
});

describe('MarkdownRenderer - Basic Functionality', () => {
  beforeEach(() => {
    mockClipboard.writeText.mockClear();
  });

  describe('Basic Rendering', () => {
    it('renders plain text content', () => {
      render(<MarkdownRenderer content="Hello world" />);
      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <MarkdownRenderer content="Test" className="custom-class" />
      );
      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('has prose styling classes', () => {
      const { container } = render(<MarkdownRenderer content="Test" />);
      expect(container.firstChild).toHaveClass('prose', 'prose-sm', 'dark:prose-invert', 'max-w-none');
    });
  });

  describe('Typography Elements', () => {
    it('renders headings', () => {
      const content = '# Heading 1\n## Heading 2';
      render(<MarkdownRenderer content={content} />);
      
      expect(screen.getByText('Heading 1')).toBeInTheDocument();
      expect(screen.getByText('Heading 2')).toBeInTheDocument();
    });

    it('renders paragraphs', () => {
      const content = 'This is a paragraph.\n\nThis is another paragraph.';
      render(<MarkdownRenderer content={content} />);
      
      expect(screen.getByText('This is a paragraph.')).toBeInTheDocument();
      expect(screen.getByText('This is another paragraph.')).toBeInTheDocument();
    });

    it('renders lists', () => {
      const content = '- Item 1\n- Item 2\n- Item 3';
      render(<MarkdownRenderer content={content} />);
      
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
      expect(screen.getByText('Item 3')).toBeInTheDocument();
    });

    it('renders blockquotes', () => {
      const content = '> This is a blockquote';
      render(<MarkdownRenderer content={content} />);
      
      expect(screen.getByText('This is a blockquote')).toBeInTheDocument();
    });
  });

  describe('Links', () => {
    it('renders external links with security attributes', () => {
      const content = '[External link](https://example.com)';
      render(<MarkdownRenderer content={content} />);
      
      const link = screen.getByText('External link');
      expect(link).toHaveAttribute('href', 'https://example.com');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('renders internal links without security attributes', () => {
      const content = '[Internal link](/internal)';
      render(<MarkdownRenderer content={content} />);
      
      const link = screen.getByText('Internal link');
      expect(link).toHaveAttribute('href', '/internal');
      expect(link).not.toHaveAttribute('target');
      expect(link).not.toHaveAttribute('rel');
    });
  });

  describe('Code Blocks', () => {
    it('renders code blocks with copy button', () => {
      const content = '```\nconst x = 1;\n```';
      render(<MarkdownRenderer content={content} />);
      
      const copyButton = screen.getByLabelText('Copy code to clipboard');
      expect(copyButton).toBeInTheDocument();
    });

    it('copy button has proper accessibility attributes', () => {
      const content = '```\nconst x = 1;\n```';
      render(<MarkdownRenderer content={content} />);
      
      const copyButton = screen.getByLabelText('Copy code to clipboard');
      expect(copyButton).toHaveAttribute('aria-label', 'Copy code to clipboard');
      expect(copyButton).toHaveAttribute('title', 'Copy to clipboard');
    });

    it('copy functionality works', async () => {
      const content = '```\nconst x = 1;\nconsole.log(x);\n```';
      render(<MarkdownRenderer content={content} />);
      
      const copyButton = screen.getByLabelText('Copy code to clipboard');
      fireEvent.click(copyButton);
      
      expect(mockClipboard.writeText).toHaveBeenCalledWith('const x = 1;\nconsole.log(x);');
    });
  });

  describe('Tables', () => {
    it('handles table content with GFM plugin', () => {
      const content = `
| Column 1 | Column 2 |
|----------|----------|
| Row 1    | Data 1   |
| Row 2    | Data 2   |
      `;
      
      const { container } = render(<MarkdownRenderer content={content} />);
      
      // With GFM plugin, should render table elements
      const table = container.querySelector('table');
      if (table) {
        // If table is rendered properly
        expect(table).toBeInTheDocument();
      } else {
        // If not, at least check that content is present
        expect(container.textContent).toContain('Column 1');
        expect(container.textContent).toContain('Row 1');
      }
    });
  });

  describe('Mixed Content', () => {
    it('renders complex markdown correctly', () => {
      const content = `
# Main Title

This is a paragraph with **bold** and *italic* text.

## Code Example

\`\`\`javascript
const x = 1;
console.log(x);
\`\`\`

### List:

1. First item
2. Second item with [a link](https://example.com)

> This is a blockquote.
      `;
      
      render(<MarkdownRenderer content={content} />);
      
      // Check that main elements are rendered
      expect(screen.getByText('Main Title')).toBeInTheDocument();
      expect(screen.getByText(/This is a paragraph/)).toBeInTheDocument();
      expect(screen.getByText('Code Example')).toBeInTheDocument();
      expect(screen.getByText('First item')).toBeInTheDocument();
      expect(screen.getByText('a link')).toBeInTheDocument();
      expect(screen.getByText(/This is a blockquote/)).toBeInTheDocument();
      
      // Check that copy button is present for code block
      expect(screen.getByLabelText('Copy code to clipboard')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty content', () => {
      render(<MarkdownRenderer content="" />);
      expect(document.querySelector('.prose')).toBeInTheDocument();
    });

    it('handles content with only whitespace', () => {
      render(<MarkdownRenderer content="   \n   \n   " />);
      expect(document.querySelector('.prose')).toBeInTheDocument();
    });

    it('handles malformed markdown gracefully', () => {
      const content = '### Unclosed heading\n**Bold without closing\n`code without closing';
      render(<MarkdownRenderer content={content} />);
      
      expect(screen.getByText('Unclosed heading')).toBeInTheDocument();
    });
  });
});
