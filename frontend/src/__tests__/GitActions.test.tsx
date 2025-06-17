import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GitActions } from '../components/GitActions';

describe('GitActions', () => {
  const mockOnPush = vi.fn();

  beforeEach(() => {
    mockOnPush.mockClear();
  });

  it('renders disabled state when no commits available', () => {
    render(
      <GitActions
        onPush={mockOnPush}
        pushing={false}
        hasCommits={false}
        disabled={false}
      />
    );

    expect(screen.getByText('No commits to push')).toBeInTheDocument();
    expect(screen.getByText('Commit your changes first before pushing to the repository.')).toBeInTheDocument();
    
    const pushButton = screen.getByRole('button', { name: /push changes/i });
    expect(pushButton).toBeDisabled();
  });

  it('renders enabled state when commits are available', () => {
    render(
      <GitActions
        onPush={mockOnPush}
        pushing={false}
        hasCommits={true}
        disabled={false}
      />
    );

    expect(screen.queryByText('No commits to push')).not.toBeInTheDocument();
    expect(screen.getByText('Ready to push to remote repository')).toBeInTheDocument();
    
    const pushButton = screen.getByRole('button', { name: /push changes/i });
    expect(pushButton).not.toBeDisabled();
  });

  it('shows loading state when pushing', () => {
    render(
      <GitActions
        onPush={mockOnPush}
        pushing={true}
        hasCommits={true}
        disabled={false}
      />
    );

    expect(screen.getByText('Pushing...')).toBeInTheDocument();
    
    const pushButton = screen.getByRole('button', { name: /pushing/i });
    expect(pushButton).toBeDisabled();
  });

  it('calls onPush when push button is clicked', async () => {
    render(
      <GitActions
        onPush={mockOnPush}
        pushing={false}
        hasCommits={true}
        disabled={false}
      />
    );

    const pushButton = screen.getByRole('button', { name: /push changes/i });
    fireEvent.click(pushButton);

    await waitFor(() => {
      expect(mockOnPush).toHaveBeenCalledTimes(1);
      expect(mockOnPush).toHaveBeenCalledWith({
        force: false,
        createPullRequest: false,
        pullRequestTitle: undefined,
        pullRequestDescription: undefined,
      });
    });
  });

  it('shows and hides push options when toggle is clicked', () => {
    render(
      <GitActions
        onPush={mockOnPush}
        pushing={false}
        hasCommits={true}
        disabled={false}
      />
    );

    // Options should be hidden initially
    expect(screen.queryByText('Create Pull Request')).not.toBeInTheDocument();

    // Click show options
    const optionsButton = screen.getByRole('button', { name: /show options/i });
    fireEvent.click(optionsButton);

    // Options should now be visible
    expect(screen.getByText('Create Pull Request')).toBeInTheDocument();
    expect(screen.getByText('Force push')).toBeInTheDocument();

    // Click hide options
    const hideButton = screen.getByRole('button', { name: /hide options/i });
    fireEvent.click(hideButton);

    // Options should be hidden again
    expect(screen.queryByText('Create Pull Request')).not.toBeInTheDocument();
  });

  it('includes pull request options when PR checkbox is selected', async () => {
    render(
      <GitActions
        onPush={mockOnPush}
        pushing={false}
        hasCommits={true}
        disabled={false}
      />
    );

    // Show options
    const optionsButton = screen.getByRole('button', { name: /show options/i });
    fireEvent.click(optionsButton);

    // Enable PR creation
    const prCheckbox = screen.getByRole('checkbox', { name: /create pull request/i });
    fireEvent.click(prCheckbox);

    // Fill in PR details
    const titleInput = screen.getByLabelText('Pull Request Title');
    const descriptionInput = screen.getByLabelText('Description (optional)');
    
    fireEvent.change(titleInput, { target: { value: 'Test PR Title' } });
    fireEvent.change(descriptionInput, { target: { value: 'Test PR Description' } });

    // Push changes
    const pushButton = screen.getByRole('button', { name: /push changes/i });
    fireEvent.click(pushButton);

    await waitFor(() => {
      expect(mockOnPush).toHaveBeenCalledWith({
        force: false,
        createPullRequest: true,
        pullRequestTitle: 'Test PR Title',
        pullRequestDescription: 'Test PR Description',
      });
    });
  });

  it('includes force push option when force checkbox is selected', async () => {
    render(
      <GitActions
        onPush={mockOnPush}
        pushing={false}
        hasCommits={true}
        disabled={false}
      />
    );

    // Show options
    const optionsButton = screen.getByRole('button', { name: /show options/i });
    fireEvent.click(optionsButton);

    // Enable force push
    const forceCheckbox = screen.getByRole('checkbox', { name: /force push/i });
    fireEvent.click(forceCheckbox);

    // Push changes
    const pushButton = screen.getByRole('button', { name: /push changes/i });
    fireEvent.click(pushButton);

    await waitFor(() => {
      expect(mockOnPush).toHaveBeenCalledWith({
        force: true,
        createPullRequest: false,
        pullRequestTitle: undefined,
        pullRequestDescription: undefined,
      });
    });
  });
});
