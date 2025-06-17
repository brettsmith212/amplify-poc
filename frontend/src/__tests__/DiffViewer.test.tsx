import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DiffViewer } from '../components/DiffViewer';
import { FileChange } from '../hooks/useDiff';

// Mock Monaco Editor components
vi.mock('@monaco-editor/react', () => ({
  Editor: ({ value }: { value: string }) => (
    <div data-testid="monaco-editor">{value}</div>
  ),
  DiffEditor: ({ original, modified }: { original: string; modified: string }) => (
    <div data-testid="monaco-diff-editor">
      <div data-testid="original-content">{original}</div>
      <div data-testid="modified-content">{modified}</div>
    </div>
  ),
}));

describe('DiffViewer', () => {
  it('renders empty state when no file is provided', () => {
    render(<DiffViewer file={null} />);
    
    expect(screen.getByText('Select a file to view changes')).toBeInTheDocument();
    expect(screen.getByText('Choose a file from the file tree to see the diff')).toBeInTheDocument();
  });

  it('renders added file with Monaco editor', () => {
    const addedFile: FileChange = {
      path: 'src/newFile.ts',
      type: 'added',
      modifiedContent: 'console.log("Hello World");',
      additions: 1,
      deletions: 0,
    };

    render(<DiffViewer file={addedFile} />);
    
    expect(screen.getByText('New file: src/newFile.ts')).toBeInTheDocument();
    expect(screen.getByText('+1 lines')).toBeInTheDocument();
    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    expect(screen.getByText('console.log("Hello World");')).toBeInTheDocument();
  });

  it('renders deleted file with Monaco editor', () => {
    const deletedFile: FileChange = {
      path: 'src/oldFile.ts',
      type: 'deleted',
      originalContent: 'console.log("Goodbye World");',
      additions: 0,
      deletions: 1,
    };

    render(<DiffViewer file={deletedFile} />);
    
    expect(screen.getByText('Deleted file: src/oldFile.ts')).toBeInTheDocument();
    expect(screen.getByText('-1 lines')).toBeInTheDocument();
    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    expect(screen.getByText('console.log("Goodbye World");')).toBeInTheDocument();
  });

  it('renders modified file with Monaco diff editor', () => {
    const modifiedFile: FileChange = {
      path: 'src/modifiedFile.ts',
      type: 'modified',
      originalContent: 'console.log("Hello");',
      modifiedContent: 'console.log("Hello World");',
      additions: 1,
      deletions: 1,
    };

    render(<DiffViewer file={modifiedFile} />);
    
    expect(screen.getByText('Modified: src/modifiedFile.ts')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(screen.getByText('-1')).toBeInTheDocument();
    expect(screen.getByTestId('monaco-diff-editor')).toBeInTheDocument();
    expect(screen.getByTestId('original-content')).toHaveTextContent('console.log("Hello");');
    expect(screen.getByTestId('modified-content')).toHaveTextContent('console.log("Hello World");');
  });

  it('renders fallback state for invalid file data', () => {
    const invalidFile: FileChange = {
      path: 'src/invalid.ts',
      type: 'modified',
      // Missing content
      additions: 0,
      deletions: 0,
    };

    render(<DiffViewer file={invalidFile} />);
    
    expect(screen.getByText('Unable to display file content')).toBeInTheDocument();
    expect(screen.getByText('The file content could not be loaded')).toBeInTheDocument();
  });
});
