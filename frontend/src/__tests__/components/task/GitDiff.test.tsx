import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import GitDiff from '../../../components/task/GitDiff';
import { api } from '../../../utils/api';

// Mock the API
vi.mock('../../../utils/api', () => ({
  api: {
    get: vi.fn()
  }
}));

// Mock SimpleDiffViewer
vi.mock('../../../components/SimpleDiffViewer', () => ({
  SimpleDiffViewer: ({ diffText, className }: { diffText: string; className?: string }) => (
    <div data-testid="simple-diff-viewer" className={className}>
      {diffText || 'No diff content'}
    </div>
  )
}));

// Mock CommitPanel and GitActions
vi.mock('../../../components/CommitPanel', () => ({
  CommitPanel: ({ onCommit, committing, disabled, hasChanges }: any) => (
    <div data-testid="commit-panel">
      CommitPanel - committing: {committing.toString()}, disabled: {disabled.toString()}, hasChanges: {hasChanges.toString()}
      <button onClick={() => onCommit({ message: 'test commit' })} disabled={disabled}>
        Commit
      </button>
    </div>
  )
}));

vi.mock('../../../components/GitActions', () => ({
  GitActions: ({ onPush, pushing, hasCommits, disabled }: any) => (
    <div data-testid="git-actions">
      GitActions - pushing: {pushing.toString()}, hasCommits: {hasCommits.toString()}, disabled: {disabled.toString()}
      <button onClick={() => onPush()} disabled={disabled}>
        Push
      </button>
    </div>
  )
}));

// Mock useGit hook
vi.mock('../../../hooks/useGit', () => ({
  useGit: () => ({
    committing: false,
    pushing: false,
    error: null,
    lastCommitHash: null,
    commit: vi.fn().mockResolvedValue({ success: true }),
    push: vi.fn().mockResolvedValue({ success: true }),
    clearError: vi.fn()
  })
}));

describe('GitDiff', () => {
  const defaultProps = {
    sessionId: 'test-session-123'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  const mockGet = api.get as any;

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Loading States', () => {
    it('shows loading spinner while fetching diff', () => {
      // Mock a promise that doesn't resolve immediately
      mockGet.mockReturnValue(new Promise(() => {}));
      
      render(<GitDiff {...defaultProps} />);
      
      expect(screen.getByText('Loading changes...')).toBeInTheDocument();
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('shows diff content when loaded successfully', async () => {
      const mockDiffData = {
        rawDiff: 'diff --git a/file.js b/file.js\n+console.log("hello");',
        hasChanges: true,
        repositoryName: 'test-repo',
        branch: 'main'
      };

      mockGet.mockResolvedValue({
        success: true,
        data: mockDiffData
      });

      render(<GitDiff {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Git Diff')).toBeInTheDocument();
        expect(screen.getByText('test-repo • main')).toBeInTheDocument();
        expect(screen.getByTestId('simple-diff-viewer')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('shows error state when API call fails', async () => {
      const errorMessage = 'Failed to load diff';
      mockGet.mockRejectedValue(new Error(errorMessage));

      render(<GitDiff {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Error Loading Changes')).toBeInTheDocument();
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('shows error state when API returns error response', async () => {
      const errorMessage = 'API Error';
      mockGet.mockResolvedValue({
        success: false,
        error: errorMessage
      });

      render(<GitDiff {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Error Loading Changes')).toBeInTheDocument();
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    it('calls onError callback when error occurs', async () => {
      const onError = vi.fn();
      const errorMessage = 'Test error';
      
      mockGet.mockRejectedValue(new Error(errorMessage));

      render(<GitDiff {...defaultProps} onError={onError} />);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({
          message: errorMessage
        }));
      });
    });
  });

  describe('Refresh Functionality', () => {
    it('refetches data when refresh button is clicked', async () => {
      const mockDiffData = {
        rawDiff: 'initial diff content',
        hasChanges: true,
        repositoryName: 'test-repo',
        branch: 'main'
      };

      mockGet.mockResolvedValue({
        success: true,
        data: mockDiffData
      });

      render(<GitDiff {...defaultProps} />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Git Diff')).toBeInTheDocument();
      });

      // Clear mock to verify refresh call
      mockGet.mockClear();
      
      // Update mock for refresh
      const updatedDiffData = {
        ...mockDiffData,
        rawDiff: 'updated diff content'
      };
      mockGet.mockResolvedValue({
        success: true,
        data: updatedDiffData
      });

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith('/sessions/test-session-123/diff');
      });
    });

    it('calls onRefresh callback when refresh is triggered', async () => {
      const onRefresh = vi.fn();
      
      mockGet.mockResolvedValue({
        success: true,
        data: { rawDiff: '', hasChanges: false }
      });

      render(<GitDiff {...defaultProps} onRefresh={onRefresh} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(onRefresh).toHaveBeenCalled();
      });
    });

    it('retries after error when retry button is clicked', async () => {
      // First call fails
      mockGet.mockRejectedValueOnce(new Error('Network error'));
      
      render(<GitDiff {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Error Loading Changes')).toBeInTheDocument();
      });

      // Second call succeeds
      mockGet.mockResolvedValue({
        success: true,
        data: { rawDiff: 'recovered diff', hasChanges: true }
      });

      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('Git Diff')).toBeInTheDocument();
        expect(screen.queryByText('Error Loading Changes')).not.toBeInTheDocument();
      });
    });
  });

  describe('Content Display', () => {
    it('displays repository and branch info when available', async () => {
      const mockDiffData = {
        rawDiff: 'diff content',
        hasChanges: true,
        repositoryName: 'my-awesome-repo',
        branch: 'feature-branch'
      };

      mockGet.mockResolvedValue({
        success: true,
        data: mockDiffData
      });

      render(<GitDiff {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('my-awesome-repo • feature-branch')).toBeInTheDocument();
      });
    });

    it('does not display repository info when no changes', async () => {
      const mockDiffData = {
        rawDiff: '',
        hasChanges: false
      };

      mockGet.mockResolvedValue({
        success: true,
        data: mockDiffData
      });

      render(<GitDiff {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Git Diff')).toBeInTheDocument();
        expect(screen.queryByText(/•/)).not.toBeInTheDocument();
      });
    });

    it('passes diff text to SimpleDiffViewer', async () => {
      const diffContent = 'diff --git a/file.js +new line';
      const mockDiffData = {
        rawDiff: diffContent,
        hasChanges: true
      };

      mockGet.mockResolvedValue({
        success: true,
        data: mockDiffData
      });

      render(<GitDiff {...defaultProps} />);

      await waitFor(() => {
        const diffViewer = screen.getByTestId('simple-diff-viewer');
        expect(diffViewer).toHaveTextContent(diffContent);
      });
    });
  });

  describe('API Integration', () => {
    it('makes correct API call with session ID', () => {
      mockGet.mockReturnValue(new Promise(() => {}));
      
      render(<GitDiff {...defaultProps} />);
      
      expect(mockGet).toHaveBeenCalledWith('/sessions/test-session-123/diff');
    });

    it('refetches data when sessionId changes', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: { rawDiff: '', hasChanges: false }
      });

      const { rerender } = render(<GitDiff {...defaultProps} />);

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith('/sessions/test-session-123/diff');
      });

      mockGet.mockClear();

      rerender(<GitDiff sessionId="new-session-456" />);

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith('/sessions/new-session-456/diff');
      });
    });
  });

  describe('CSS Classes', () => {
    it('applies custom className', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: { rawDiff: '', hasChanges: false }
      });

      const { container } = render(
        <GitDiff {...defaultProps} className="custom-class" />
      );

      await waitFor(() => {
        expect(container.firstChild).toHaveClass('custom-class');
      });
    });

    it('applies correct layout classes', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: { rawDiff: '', hasChanges: false }
      });

      const { container } = render(<GitDiff {...defaultProps} />);

      await waitFor(() => {
        expect(container.firstChild).toHaveClass('h-full', 'flex', 'flex-col');
      });
    });
  });

  describe('Git Actions Integration', () => {
    it('shows git actions button in header', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: { rawDiff: '', hasChanges: false }
      });

      render(<GitDiff {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /git actions/i })).toBeInTheDocument();
      });
    });

    it('toggles git operations panel when git actions button is clicked', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: { rawDiff: '', hasChanges: false }
      });

      render(<GitDiff {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /git actions/i })).toBeInTheDocument();
      });

      // Initially, git operations should not be visible
      expect(screen.queryByTestId('commit-panel')).not.toBeInTheDocument();
      expect(screen.queryByTestId('git-actions')).not.toBeInTheDocument();

      // Click git actions button
      const gitActionsButton = screen.getByRole('button', { name: /git actions/i });
      fireEvent.click(gitActionsButton);

      // Git operations should now be visible
      await waitFor(() => {
        expect(screen.getByTestId('commit-panel')).toBeInTheDocument();
        expect(screen.getByTestId('git-actions')).toBeInTheDocument();
      });

      // Button text should change
      expect(screen.getByRole('button', { name: /hide git actions/i })).toBeInTheDocument();
    });

    it('passes correct props to CommitPanel', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: { rawDiff: 'test diff', hasChanges: true }
      });

      render(<GitDiff {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /git actions/i })).toBeInTheDocument();
      });

      // Open git operations
      fireEvent.click(screen.getByRole('button', { name: /git actions/i }));

      await waitFor(() => {
        const commitPanel = screen.getByTestId('commit-panel');
        expect(commitPanel).toHaveTextContent('hasChanges: true');
        expect(commitPanel).toHaveTextContent('disabled: false');
      });
    });

    it('passes correct props to GitActions', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: { rawDiff: 'test diff', hasChanges: true }
      });

      render(<GitDiff {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /git actions/i })).toBeInTheDocument();
      });

      // Open git operations
      fireEvent.click(screen.getByRole('button', { name: /git actions/i }));

      await waitFor(() => {
        const gitActions = screen.getByTestId('git-actions');
        expect(gitActions).toHaveTextContent('pushing: false');
        expect(gitActions).toHaveTextContent('disabled: false');
      });
    });

    it('hides git operations when toggled again', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: { rawDiff: '', hasChanges: false }
      });

      render(<GitDiff {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /git actions/i })).toBeInTheDocument();
      });

      // Open git operations
      fireEvent.click(screen.getByRole('button', { name: /git actions/i }));

      await waitFor(() => {
        expect(screen.getByTestId('commit-panel')).toBeInTheDocument();
      });

      // Close git operations
      fireEvent.click(screen.getByRole('button', { name: /hide git actions/i }));

      await waitFor(() => {
        expect(screen.queryByTestId('commit-panel')).not.toBeInTheDocument();
        expect(screen.queryByTestId('git-actions')).not.toBeInTheDocument();
      });
    });
  });
});
