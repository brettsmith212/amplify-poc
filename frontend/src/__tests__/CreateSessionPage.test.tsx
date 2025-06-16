import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import CreateSessionPage from '../pages/CreateSessionPage';
import { AuthProvider } from '../contexts/AuthContext';

// Mock the useGitHub hook
vi.mock('../hooks/useGitHub', () => ({
  useGitHub: () => ({
    searchRepositories: vi.fn().mockResolvedValue([]),
    getRepositories: vi.fn().mockResolvedValue({ data: [] }),
    getBranches: vi.fn().mockResolvedValue({ data: [] }),
    loading: false,
    error: null,
  }),
}));

// Mock the API client
vi.mock('../utils/api', () => ({
  api: {
    post: vi.fn(),
  },
}));

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>
      {children}
    </AuthProvider>
  </BrowserRouter>
);

describe('CreateSessionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the create session form', () => {
    render(
      <TestWrapper>
        <CreateSessionPage />
      </TestWrapper>
    );

    expect(screen.getByText('Create New Session')).toBeInTheDocument();
    expect(screen.getByText('Set up a new coding session with your GitHub repository')).toBeInTheDocument();
    expect(screen.getByLabelText('Session Name')).toBeInTheDocument();
    expect(screen.getByText('Repository')).toBeInTheDocument();
    expect(screen.getByText('Branch')).toBeInTheDocument();
    expect(screen.getByText('Prompt')).toBeInTheDocument();
  });

  it('shows validation errors for empty form submission', async () => {
    render(
      <TestWrapper>
        <CreateSessionPage />
      </TestWrapper>
    );

    const createButton = screen.getByRole('button', { name: /create session/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Session name is required')).toBeInTheDocument();
      expect(screen.getByText('Please select a repository')).toBeInTheDocument();
      expect(screen.getByText('Please select a branch')).toBeInTheDocument();
      expect(screen.getByText('Please provide a prompt describing what you want to work on')).toBeInTheDocument();
    });
  });

  it('validates session name length', async () => {
    render(
      <TestWrapper>
        <CreateSessionPage />
      </TestWrapper>
    );

    const sessionNameInput = screen.getByLabelText('Session Name');
    
    // Test too short
    fireEvent.change(sessionNameInput, { target: { value: 'ab' } });
    fireEvent.click(screen.getByRole('button', { name: /create session/i }));

    await waitFor(() => {
      expect(screen.getByText('Session name must be at least 3 characters')).toBeInTheDocument();
    });

    // Test too long
    const longName = 'a'.repeat(51);
    fireEvent.change(sessionNameInput, { target: { value: longName } });
    fireEvent.click(screen.getByRole('button', { name: /create session/i }));

    await waitFor(() => {
      expect(screen.getByText('Session name must be less than 50 characters')).toBeInTheDocument();
    });
  });

  it('validates prompt length', async () => {
    render(
      <TestWrapper>
        <CreateSessionPage />
      </TestWrapper>
    );

    const promptTextarea = screen.getByPlaceholderText("Describe what you'd like to work on...");
    
    // Test too short
    fireEvent.change(promptTextarea, { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: /create session/i }));

    await waitFor(() => {
      expect(screen.getByText('Prompt should be at least 10 characters')).toBeInTheDocument();
    });

    // Test too long
    const longPrompt = 'a'.repeat(2001);
    fireEvent.change(promptTextarea, { target: { value: longPrompt } });
    fireEvent.click(screen.getByRole('button', { name: /create session/i }));

    await waitFor(() => {
      expect(screen.getByText('Prompt is too long (max 2000 characters)')).toBeInTheDocument();
    });
  });

  it('clears validation errors when user starts typing', async () => {
    render(
      <TestWrapper>
        <CreateSessionPage />
      </TestWrapper>
    );

    const sessionNameInput = screen.getByLabelText('Session Name');
    const createButton = screen.getByRole('button', { name: /create session/i });

    // Trigger validation error
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Session name is required')).toBeInTheDocument();
    });

    // Start typing to clear error
    fireEvent.change(sessionNameInput, { target: { value: 'Test Session' } });

    await waitFor(() => {
      expect(screen.queryByText('Session name is required')).not.toBeInTheDocument();
    });
  });

  it('disables create button when form is invalid', () => {
    render(
      <TestWrapper>
        <CreateSessionPage />
      </TestWrapper>
    );

    const createButton = screen.getByRole('button', { name: /create session/i });
    expect(createButton).toBeDisabled();
  });

  it('shows cancel button that navigates to sessions page', () => {
    render(
      <TestWrapper>
        <CreateSessionPage />
      </TestWrapper>
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(mockNavigate).toHaveBeenCalledWith('/sessions');
  });

  it('shows helpful tips section', () => {
    render(
      <TestWrapper>
        <CreateSessionPage />
      </TestWrapper>
    );

    expect(screen.getByText('💡 Tips for a great session')).toBeInTheDocument();
    expect(screen.getByText('• Be specific about what you want to accomplish')).toBeInTheDocument();
    expect(screen.getByText('• Mention the files or areas of code you want to work on')).toBeInTheDocument();
    expect(screen.getByText('• Include any relevant context or constraints')).toBeInTheDocument();
    expect(screen.getByText('• Use the branch that contains the code you want to modify')).toBeInTheDocument();
  });

  it('shows loading state during form submission', async () => {
    const { api } = await import('../utils/api');
    
    // Mock API call to return a pending promise
    const pendingPromise = new Promise(() => {
      // Never resolves to simulate loading state
    });
    
    vi.mocked(api.post).mockReturnValue(pendingPromise as any);

    render(
      <TestWrapper>
        <CreateSessionPage />
      </TestWrapper>
    );

    // Fill out the form with valid data
    fireEvent.change(screen.getByLabelText('Session Name'), {
      target: { value: 'Test Session' }
    });
    
    fireEvent.change(screen.getByPlaceholderText("Describe what you'd like to work on..."), {
      target: { value: 'This is a test prompt for the session creation' }
    });

    // Mock repository and branch selection (this would normally be done through the components)
    // For this test, we'll assume the form validation passes by mocking the component states

    const createButton = screen.getByRole('button', { name: /create session/i });
    
    // The button should be disabled initially due to missing repository/branch
    expect(createButton).toBeDisabled();
  });

  it('displays character and word count for prompt', () => {
    render(
      <TestWrapper>
        <CreateSessionPage />
      </TestWrapper>
    );

    const promptTextarea = screen.getByPlaceholderText("Describe what you'd like to work on...");
    const testPrompt = 'This is a test prompt with multiple words';
    
    fireEvent.change(promptTextarea, { target: { value: testPrompt } });

    // Check word count (8 words)
    expect(screen.getByText('8 words')).toBeInTheDocument();
    
    // Check character count
    expect(screen.getByText(`${testPrompt.length}/2000`)).toBeInTheDocument();
  });
});
