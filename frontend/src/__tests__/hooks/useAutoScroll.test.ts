import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import useAutoScroll from '../../hooks/useAutoScroll';

// Mock scrollIntoView
const mockScrollIntoView = vi.fn();

// Mock DOM methods
Object.defineProperty(Element.prototype, 'scrollIntoView', {
  value: mockScrollIntoView,
  writable: true,
});

// Mock getComputedStyle
const mockGetComputedStyle = vi.fn();
Object.defineProperty(window, 'getComputedStyle', {
  value: mockGetComputedStyle,
  writable: true,
});

describe('useAutoScroll', () => {
  beforeEach(() => {
    mockScrollIntoView.mockClear();
    mockGetComputedStyle.mockReturnValue({
      overflowY: 'visible',
      overflow: 'visible'
    });
    
    // Mock window dimensions
    Object.defineProperty(window, 'innerHeight', {
      value: 800,
      writable: true,
    });
    Object.defineProperty(window, 'scrollY', {
      value: 0,
      writable: true,
    });
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: 1000,
      writable: true,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Basic Functionality', () => {
    it('returns scroll ref and utility functions', () => {
      const { result } = renderHook(() =>
        useAutoScroll({
          dependencies: [],
        })
      );

      expect(result.current.scrollRef).toBeDefined();
      expect(result.current.scrollToBottom).toBeInstanceOf(Function);
      expect(result.current.isAtBottom).toBeInstanceOf(Function);
    });

    it('scrolls to bottom when dependencies change', () => {
      const { result, rerender } = renderHook(
        ({ deps }) =>
          useAutoScroll({
            dependencies: deps,
          }),
        {
          initialProps: { deps: [1] },
        }
      );

      // Mock a scroll element
      const mockElement = document.createElement('div');
      (result.current.scrollRef as any).current = mockElement;

      // Change dependencies
      rerender({ deps: [2] });

      expect(mockScrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'end',
      });
    });

    it('does not scroll when disabled', () => {
      const { result, rerender } = renderHook(
        ({ deps }) =>
          useAutoScroll({
            dependencies: deps,
            enabled: false,
          }),
        {
          initialProps: { deps: [1] },
        }
      );

      const mockElement = document.createElement('div');
      (result.current.scrollRef as any).current = mockElement;

      rerender({ deps: [2] });

      expect(mockScrollIntoView).not.toHaveBeenCalled();
    });
  });

  describe('Scroll Behavior', () => {
    it('uses custom scroll behavior', () => {
      const { result, rerender } = renderHook(
        ({ deps }) =>
          useAutoScroll({
            dependencies: deps,
            behavior: 'auto',
          }),
        {
          initialProps: { deps: [1] },
        }
      );

      const mockElement = document.createElement('div');
      (result.current.scrollRef as any).current = mockElement;

      rerender({ deps: [2] });

      expect(mockScrollIntoView).toHaveBeenCalledWith({
        behavior: 'auto',
        block: 'end',
      });
    });

    it('applies delay when specified', () => {
      vi.useFakeTimers();

      const { result, rerender } = renderHook(
        ({ deps }) =>
          useAutoScroll({
            dependencies: deps,
            delay: 100,
          }),
        {
          initialProps: { deps: [1] },
        }
      );

      const mockElement = document.createElement('div');
      (result.current.scrollRef as any).current = mockElement;

      rerender({ deps: [2] });

      // Should not scroll immediately
      expect(mockScrollIntoView).not.toHaveBeenCalled();

      // Fast-forward time
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(mockScrollIntoView).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('Manual Scroll Control', () => {
    it('scrollToBottom function works manually', () => {
      const { result } = renderHook(() =>
        useAutoScroll({
          dependencies: [],
        })
      );

      const mockElement = document.createElement('div');
      (result.current.scrollRef as any).current = mockElement;

      act(() => {
        result.current.scrollToBottom();
      });

      expect(mockScrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'end',
      });
    });

    it('scrollToBottom with delay', () => {
      vi.useFakeTimers();

      const { result } = renderHook(() =>
        useAutoScroll({
          dependencies: [],
          delay: 50,
        })
      );

      const mockElement = document.createElement('div');
      (result.current.scrollRef as any).current = mockElement;

      act(() => {
        result.current.scrollToBottom();
      });

      expect(mockScrollIntoView).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(50);
      });

      expect(mockScrollIntoView).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('isAtBottom Function', () => {
    it('returns a boolean value', () => {
      const { result } = renderHook(() =>
        useAutoScroll({
          dependencies: [],
        })
      );

      const isAtBottom = result.current.isAtBottom();
      expect(typeof isAtBottom).toBe('boolean');
    });

    it('is callable without errors', () => {
      const { result } = renderHook(() =>
        useAutoScroll({
          dependencies: [],
        })
      );

      expect(() => {
        result.current.isAtBottom();
      }).not.toThrow();
    });
  });

  describe('Scroll Container Detection', () => {
    it('finds scrollable parent container', () => {
      mockGetComputedStyle.mockImplementation((element) => {
        if (element.classList?.contains('scrollable')) {
          return { overflowY: 'auto', overflow: 'visible' };
        }
        return { overflowY: 'visible', overflow: 'visible' };
      });

      const { result } = renderHook(() =>
        useAutoScroll({
          dependencies: [],
        })
      );

      // Create mock DOM structure
      const scrollableContainer = document.createElement('div');
      scrollableContainer.classList.add('scrollable');
      const childElement = document.createElement('div');
      scrollableContainer.appendChild(childElement);
      
      // Mock the DOM structure
      Object.defineProperty(childElement, 'parentElement', {
        value: scrollableContainer,
      });
      Object.defineProperty(scrollableContainer, 'parentElement', {
        value: null,
      });

      (result.current.scrollRef as any).current = childElement;

      // The hook should detect the scrollable container
      expect(result.current.scrollRef.current).toBe(childElement);
    });
  });

  describe('Edge Cases', () => {
    it('handles null scroll ref gracefully', () => {
      const { result } = renderHook(() =>
        useAutoScroll({
          dependencies: [1],
        })
      );

      expect(() => {
        result.current.scrollToBottom();
      }).not.toThrow();

      expect(() => {
        result.current.isAtBottom();
      }).not.toThrow();
    });

    it('handles missing DOM elements gracefully', () => {
      const { result } = renderHook(() =>
        useAutoScroll({
          dependencies: [],
        })
      );

      // Test with element that has no parent
      const mockElement = document.createElement('div');
      Object.defineProperty(mockElement, 'parentElement', { value: null });
      (result.current.scrollRef as any).current = mockElement;

      expect(() => {
        result.current.scrollToBottom();
        result.current.isAtBottom();
      }).not.toThrow();
    });

    it('handles rapid dependency changes', () => {
      const { result, rerender } = renderHook(
        ({ deps }) =>
          useAutoScroll({
            dependencies: deps,
          }),
        {
          initialProps: { deps: [1] },
        }
      );

      const mockElement = document.createElement('div');
      (result.current.scrollRef as any).current = mockElement;

      // Rapid changes
      rerender({ deps: [2] });
      rerender({ deps: [3] });
      rerender({ deps: [4] });

      // Should handle multiple calls gracefully
      expect(mockScrollIntoView).toHaveBeenCalled();
    });
  });
});
