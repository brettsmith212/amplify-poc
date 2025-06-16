import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useGitHub, Repository } from '../hooks/useGitHub';

interface RepoSelectorProps {
  value?: Repository | null;
  onChange: (repo: Repository | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const RepoSelector: React.FC<RepoSelectorProps> = ({
  value,
  onChange,
  placeholder = "Search repositories...",
  disabled = false,
  className = "",
}) => {
  const [query, setQuery] = useState('');
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showRecent, setShowRecent] = useState(false);
  
  const { searchRepositories, getRepositories, loading, error } = useGitHub();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search
  const searchTimeoutRef = useRef<number>();

  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.trim()) {
      const results = await searchRepositories(searchQuery, { limit: 10 });
      setRepositories(results);
      setShowRecent(false);
    } else {
      // Show recent repositories when no query
      try {
        const result = await getRepositories(
          { sort: 'updated', direction: 'desc' },
          { per_page: 10 }
        );
        setRepositories(result.data || []);
        setShowRecent(true);
      } catch (err) {
        console.error('Error fetching recent repositories:', err);
        setRepositories([]);
      }
    }
  }, [searchRepositories, getRepositories]);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = window.setTimeout(() => {
      if (isOpen) {
        performSearch(query);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, isOpen, performSearch]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    
    if (newQuery !== (value?.full_name || '')) {
      onChange(null);
    }
    
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  const handleInputFocus = () => {
    if (!isOpen) {
      setIsOpen(true);
      performSearch(query);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < repositories.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < repositories.length) {
          const selectedRepo = repositories[selectedIndex];
          if (selectedRepo) {
            selectRepository(selectedRepo);
          }
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const selectRepository = (repo: Repository) => {
    onChange(repo);
    setQuery(repo.full_name);
    setIsOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.blur();
  };

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        });
      }
    }
  }, [selectedIndex]);

  // Update input when value changes externally
  useEffect(() => {
    if (value) {
      setQuery(value.full_name);
    } else if (!isOpen) {
      setQuery('');
    }
  }, [value, isOpen]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
            focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            disabled:bg-gray-50 disabled:text-gray-500
            ${error ? 'border-red-300' : ''}
          `}
        />
        
        {loading && (
          <div className="absolute right-3 top-2.5">
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        )}
        
        {error && (
          <div className="absolute right-3 top-2.5">
            <svg className="h-4 w-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {repositories.length === 0 && !loading ? (
            <div className="px-3 py-2 text-gray-500 text-sm">
              {query ? 'No repositories found' : 'No repositories available'}
            </div>
          ) : (
            <>
              {showRecent && repositories.length > 0 && (
                <div className="px-3 py-1 text-xs font-medium text-gray-400 bg-gray-50 border-b">
                  Recent Repositories
                </div>
              )}
              
              <ul ref={listRef} className="py-1">
                {repositories.map((repo, index) => (
                  <li
                    key={repo.id}
                    className={`
                      px-3 py-2 cursor-pointer hover:bg-gray-50
                      ${index === selectedIndex ? 'bg-blue-50 text-blue-700' : ''}
                    `}
                    onClick={() => selectRepository(repo)}
                  >
                    <div className="flex items-center space-x-3">
                      <img
                        src={repo.owner.avatar_url}
                        alt={repo.owner.login}
                        className="w-6 h-6 rounded-full"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {repo.full_name}
                        </div>
                        {repo.description && (
                          <div className="text-xs text-gray-500 truncate">
                            {repo.description}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-gray-400">
                        {repo.language && (
                          <span className="bg-gray-100 px-2 py-1 rounded">
                            {repo.language}
                          </span>
                        )}
                        {repo.private && (
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      
      {error && (
        <div className="mt-1 text-sm text-red-600">
          {error}
        </div>
      )}
    </div>
  );
};

export default RepoSelector;
