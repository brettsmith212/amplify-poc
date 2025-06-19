import { useEffect, useRef } from 'react';

interface UseAutoScrollOptions {
  /**
   * Dependencies array that triggers scrolling when changed
   */
  dependencies: React.DependencyList;
  
  /**
   * Whether auto-scrolling is enabled
   */
  enabled?: boolean;
  
  /**
   * Scroll behavior type
   */
  behavior?: ScrollBehavior;
  
  /**
   * Delay in milliseconds before scrolling (useful for DOM updates)
   */
  delay?: number;
}

interface UseAutoScrollReturn {
  /**
   * Ref to attach to the scroll anchor element
   */
  scrollRef: React.RefObject<HTMLDivElement>;
  
  /**
   * Manually trigger scroll to bottom
   */
  scrollToBottom: () => void;
  
  /**
   * Check if user has manually scrolled up (not at bottom)
   */
  isAtBottom: () => boolean;
}

/**
 * Custom hook for managing auto-scroll behavior in chat-like interfaces
 */
export const useAutoScroll = ({
  dependencies,
  enabled = true,
  behavior = 'smooth',
  delay = 0
}: UseAutoScrollOptions): UseAutoScrollReturn => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const shouldAutoScrollRef = useRef(true);

  // Find the scrollable container
  useEffect(() => {
    if (scrollRef.current) {
      let element = scrollRef.current.parentElement;
      while (element) {
        const style = getComputedStyle(element);
        if (
          style.overflowY === 'auto' || 
          style.overflowY === 'scroll' || 
          style.overflow === 'auto' || 
          style.overflow === 'scroll'
        ) {
          containerRef.current = element;
          break;
        }
        element = element.parentElement;
      }
      
      // Fallback to window if no scrollable container found
      if (!containerRef.current) {
        containerRef.current = document.documentElement;
      }
    }
  }, []);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current;
      
      if (delay > 0) {
        setTimeout(() => {
          scrollElement.scrollIntoView({ 
            behavior,
            block: 'end'
          });
        }, delay);
      } else {
        scrollElement.scrollIntoView({ 
          behavior,
          block: 'end'
        });
      }
    }
  };

  const isAtBottom = (): boolean => {
    if (!containerRef.current) return true;
    
    const container = containerRef.current;
    const threshold = 100; // Consider "at bottom" if within 100px of bottom
    
    if (container === document.documentElement) {
      return (
        window.innerHeight + window.scrollY >= 
        document.documentElement.scrollHeight - threshold
      );
    } else {
      return (
        container.scrollTop + container.clientHeight >= 
        container.scrollHeight - threshold
      );
    }
  };

  // Track if user has manually scrolled
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    const handleScroll = () => {
      shouldAutoScrollRef.current = isAtBottom();
    };

    const scrollElement = container === document.documentElement ? window : container;
    scrollElement.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
    };
  }, [enabled]);

  // Auto-scroll when dependencies change
  useEffect(() => {
    if (enabled && shouldAutoScrollRef.current) {
      scrollToBottom();
    }
  }, dependencies);

  // Initially scroll to bottom and assume user is at bottom
  useEffect(() => {
    if (enabled) {
      shouldAutoScrollRef.current = true;
      scrollToBottom();
    }
  }, [enabled]);

  return {
    scrollRef,
    scrollToBottom,
    isAtBottom
  };
};

export default useAutoScroll;
