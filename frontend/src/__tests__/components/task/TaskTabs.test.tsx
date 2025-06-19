import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TaskTabs from '../../../components/task/TaskTabs';
import { TabType } from '../../../types/tabs';

describe('TaskTabs', () => {
  const mockOnTabChange = vi.fn();
  
  beforeEach(() => {
    mockOnTabChange.mockClear();
  });

  it('renders all tabs with correct labels', () => {
    render(
      <TaskTabs 
        activeTab="thread" 
        onTabChange={mockOnTabChange}
      />
    );
    
    expect(screen.getByText('Thread')).toBeInTheDocument();
    expect(screen.getByText('Terminal')).toBeInTheDocument();
    expect(screen.getByText('Git Diff')).toBeInTheDocument();
  });

  it('shows the active tab with correct styling', () => {
    render(
      <TaskTabs 
        activeTab="thread" 
        onTabChange={mockOnTabChange}
      />
    );
    
    const threadTab = screen.getByRole('tab', { name: /thread/i });
    expect(threadTab).toHaveAttribute('aria-selected', 'true');
    expect(threadTab).toHaveClass('text-blue-400');
  });

  it('shows inactive tabs with correct styling', () => {
    render(
      <TaskTabs 
        activeTab="thread" 
        onTabChange={mockOnTabChange}
      />
    );
    
    const terminalTab = screen.getByRole('tab', { name: /terminal/i });
    expect(terminalTab).toHaveAttribute('aria-selected', 'false');
    expect(terminalTab).toHaveClass('text-gray-400');
  });

  it('calls onTabChange when tab is clicked', () => {
    render(
      <TaskTabs 
        activeTab="thread" 
        onTabChange={mockOnTabChange}
      />
    );
    
    const terminalTab = screen.getByRole('tab', { name: /terminal/i });
    fireEvent.click(terminalTab);
    
    expect(mockOnTabChange).toHaveBeenCalledWith('terminal');
  });

  it('calls onTabChange when Enter key is pressed', () => {
    render(
      <TaskTabs 
        activeTab="thread" 
        onTabChange={mockOnTabChange}
      />
    );
    
    const terminalTab = screen.getByRole('tab', { name: /terminal/i });
    fireEvent.keyDown(terminalTab, { key: 'Enter' });
    
    expect(mockOnTabChange).toHaveBeenCalledWith('terminal');
  });

  it('calls onTabChange when Space key is pressed', () => {
    render(
      <TaskTabs 
        activeTab="thread" 
        onTabChange={mockOnTabChange}
      />
    );
    
    const terminalTab = screen.getByRole('tab', { name: /terminal/i });
    fireEvent.keyDown(terminalTab, { key: ' ' });
    
    expect(mockOnTabChange).toHaveBeenCalledWith('terminal');
  });

  it('does not call onTabChange for other keys', () => {
    render(
      <TaskTabs 
        activeTab="thread" 
        onTabChange={mockOnTabChange}
      />
    );
    
    const terminalTab = screen.getByRole('tab', { name: /terminal/i });
    fireEvent.keyDown(terminalTab, { key: 'ArrowRight' });
    
    expect(mockOnTabChange).not.toHaveBeenCalled();
  });

  it('renders with custom className', () => {
    const { container } = render(
      <TaskTabs 
        activeTab="thread" 
        onTabChange={mockOnTabChange}
        className="custom-class"
      />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('sets correct tabIndex for active tab', () => {
    render(
      <TaskTabs 
        activeTab="terminal" 
        onTabChange={mockOnTabChange}
      />
    );
    
    const activeTab = screen.getByRole('tab', { name: /terminal/i });
    const inactiveTab = screen.getByRole('tab', { name: /thread/i });
    
    expect(activeTab).toHaveAttribute('tabIndex', '0');
    expect(inactiveTab).toHaveAttribute('tabIndex', '-1');
  });

  it('renders icons for each tab', () => {
    const { container } = render(
      <TaskTabs 
        activeTab="thread" 
        onTabChange={mockOnTabChange}
      />
    );
    
    // Check that SVG icons are present
    const svgElements = container.querySelectorAll('svg');
    expect(svgElements).toHaveLength(3); // One for each tab
  });

  it('supports all tab types', () => {
    const tabTypes: TabType[] = ['thread', 'terminal', 'gitdiff'];
    
    tabTypes.forEach(tabType => {
      const { rerender } = render(
        <TaskTabs 
          activeTab={tabType} 
          onTabChange={mockOnTabChange}
        />
      );
      
      const activeTab = screen.getByRole('tab', { selected: true });
      expect(activeTab).toBeInTheDocument();
      
      rerender(<div />); // Clean up for next iteration
    });
  });

  it('applies focus styles correctly', () => {
    render(
      <TaskTabs 
        activeTab="thread" 
        onTabChange={mockOnTabChange}
      />
    );
    
    const terminalTab = screen.getByRole('tab', { name: /terminal/i });
    terminalTab.focus();
    
    expect(terminalTab).toHaveClass('focus:ring-2', 'focus:ring-blue-500/50');
  });
});
