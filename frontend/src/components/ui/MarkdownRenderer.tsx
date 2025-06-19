import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

interface CodeBlockProps {
  inline?: boolean;
  className?: string | undefined;
  children?: React.ReactNode;
}

interface CopyButtonProps {
  content: string;
  className?: string;
}

// Copy to clipboard functionality
const CopyButton: React.FC<CopyButtonProps> = ({ content, className = '' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`
        inline-flex items-center justify-center w-8 h-8 rounded-md
        bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white
        transition-all duration-200 opacity-0 group-hover:opacity-100
        focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50
        ${className}
      `}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
      aria-label={copied ? 'Copied to clipboard' : 'Copy code to clipboard'}
    >
      {copied ? (
        <CheckIcon className="w-4 h-4" />
      ) : (
        <CopyIcon className="w-4 h-4" />
      )}
    </button>
  );
};

// Icons for copy functionality
const CopyIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

// Code block component with syntax highlighting
const CodeBlock: React.FC<CodeBlockProps> = ({ inline, className, children }) => {
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const codeContent = String(children).replace(/\n$/, '');

  if (inline) {
    return (
      <code className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">
        {children}
      </code>
    );
  }

  return (
    <div className="relative group">
      <div className="absolute top-3 right-3 z-10">
        <CopyButton content={codeContent} />
      </div>
      <SyntaxHighlighter
        style={vscDarkPlus}
        language={language || 'text'}
        PreTag="div"
        className="!bg-gray-900 !rounded-lg !text-sm !m-0"
        showLineNumbers={false}
        wrapLines={true}
        wrapLongLines={true}
      >
        {codeContent}
      </SyntaxHighlighter>
    </div>
  );
};

// Custom link component with security attributes
const LinkComponent: React.FC<React.AnchorHTMLAttributes<HTMLAnchorElement>> = ({ 
  href, 
  children, 
  ...props 
}) => {
  const isExternal = href?.startsWith('http');
  
  return (
    <a
      href={href}
      {...props}
      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline transition-colors"
      {...(isExternal && {
        target: '_blank',
        rel: 'noopener noreferrer'
      })}
    >
      {children}
    </a>
  );
};

// Custom heading components with consistent styling
const HeadingComponent = (level: number) => ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
  const baseClasses = "font-semibold text-gray-900 dark:text-gray-100 mb-3 mt-6 first:mt-0";
  const levelClasses = {
    1: "text-2xl",
    2: "text-xl", 
    3: "text-lg",
    4: "text-base",
    5: "text-sm font-medium",
    6: "text-sm"
  };
  
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  
  return React.createElement(
    Tag,
    {
      ...props,
      className: `${baseClasses} ${levelClasses[level as keyof typeof levelClasses]}`
    },
    children
  );
};

// Custom paragraph component
const ParagraphComponent: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ 
  children, 
  ...props 
}) => (
  <p 
    {...props} 
    className="text-gray-900 dark:text-gray-100 mb-4 leading-relaxed last:mb-0"
  >
    {children}
  </p>
);

// Custom list components
const ListComponent: React.FC<React.HTMLAttributes<HTMLUListElement | HTMLOListElement> & { ordered?: boolean }> = ({ 
  children, 
  ordered, 
  ...props 
}) => {
  const Tag = ordered ? 'ol' : 'ul';
  const listClass = ordered 
    ? "list-decimal list-inside space-y-1 mb-4 text-gray-900 dark:text-gray-100"
    : "list-disc list-inside space-y-1 mb-4 text-gray-900 dark:text-gray-100";
    
  return React.createElement(Tag, { ...props, className: listClass }, children);
};

// Custom list item component
const ListItemComponent: React.FC<React.HTMLAttributes<HTMLLIElement>> = ({ 
  children, 
  ...props 
}) => (
  <li {...props} className="text-gray-900 dark:text-gray-100">
    {children}
  </li>
);

// Custom blockquote component
const BlockquoteComponent: React.FC<React.HTMLAttributes<HTMLQuoteElement>> = ({ 
  children, 
  ...props 
}) => (
  <blockquote 
    {...props} 
    className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-700 dark:text-gray-300 mb-4"
  >
    {children}
  </blockquote>
);

// Custom table components
const TableComponent: React.FC<React.HTMLAttributes<HTMLTableElement>> = ({ 
  children, 
  ...props 
}) => (
  <div className="overflow-x-auto mb-4">
    <table {...props} className="min-w-full border border-gray-200 dark:border-gray-700 rounded-lg">
      {children}
    </table>
  </div>
);

const TableHeadComponent: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ 
  children, 
  ...props 
}) => (
  <thead {...props} className="bg-gray-50 dark:bg-gray-800">
    {children}
  </thead>
);

const TableRowComponent: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({ 
  children, 
  ...props 
}) => (
  <tr {...props} className="border-b border-gray-200 dark:border-gray-700">
    {children}
  </tr>
);

const TableCellComponent: React.FC<React.HTMLAttributes<HTMLTableCellElement>> = ({ 
  children, 
  ...props 
}) => (
  <td {...props} className="px-4 py-2 text-gray-900 dark:text-gray-100">
    {children}
  </td>
);

const TableHeaderComponent: React.FC<React.HTMLAttributes<HTMLTableCellElement>> = ({ 
  children, 
  ...props 
}) => (
  <th {...props} className="px-4 py-2 text-left font-medium text-gray-900 dark:text-gray-100">
    {children}
  </th>
);

// Main MarkdownRenderer component
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ 
  content, 
  className = '' 
}) => {
  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: CodeBlock,
          a: LinkComponent,
          h1: HeadingComponent(1),
          h2: HeadingComponent(2),
          h3: HeadingComponent(3),
          h4: HeadingComponent(4),
          h5: HeadingComponent(5),
          h6: HeadingComponent(6),
          p: ParagraphComponent,
          ul: (props) => <ListComponent {...props} />,
          ol: (props) => <ListComponent {...props} ordered />,
          li: ListItemComponent,
          blockquote: BlockquoteComponent,
          table: TableComponent,
          thead: TableHeadComponent,
          tr: TableRowComponent,
          td: TableCellComponent,
          th: TableHeaderComponent,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
