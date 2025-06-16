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
    
    if (newQuery !== (value?.fullName || '')) {
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
    setQuery(repo.fullName);
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
      setQuery(value.fullName);
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
            w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 
            rounded-xl shadow-sm transition-all duration-200 ease-in-out
            bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
            placeholder-gray-500 dark:placeholder-gray-400
            focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none
            hover:border-gray-300 dark:hover:border-gray-500
            disabled:bg-gray-50 dark:disabled:bg-gray-900 disabled:text-gray-500 disabled:cursor-not-allowed
            ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}
            ${isOpen ? 'border-blue-500 ring-4 ring-blue-500/20' : ''}
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
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl max-h-80 overflow-hidden">
          {repositories.length === 0 && !loading ? (
            <div className="px-4 py-6 text-center text-gray-500 dark:text-gray-400 text-sm">
              <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {query ? 'No repositories found' : 'No repositories available'}
            </div>
          ) : (
            <>
              {showRecent && repositories.length > 0 && (
                <div className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-600">
                  <svg className="inline w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  Recent Repositories
                </div>
              )}
              
              <div className="max-h-72 overflow-y-auto">
                <ul ref={listRef} className="py-1">
                  {repositories.map((repo, index) => (
                    <li
                      key={repo.id}
                      className={`
                        px-4 py-3 cursor-pointer transition-all duration-150 ease-in-out
                        hover:bg-blue-50 dark:hover:bg-blue-900/20
                        ${index === selectedIndex 
                          ? 'bg-blue-100 dark:bg-blue-900/30 border-r-2 border-blue-500' 
                          : 'border-r-2 border-transparent'
                        }
                      `}
                      onClick={() => selectRepository(repo)}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          <img
                            src={repo.owner.avatarUrl}
                            alt={repo.owner.login}
                            className="w-8 h-8 rounded-full ring-2 ring-gray-100 dark:ring-gray-600"
                          />
                          {repo.private && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full flex items-center justify-center">
                              <svg className="w-2 h-2 text-yellow-800" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                            {repo.fullName}
                          </div>
                          {repo.description && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 truncate mt-0.5">
                              {repo.description}
                            </div>
                          )}
                          <div className="flex items-center space-x-2 mt-1">
                            {repo.language && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                                <span className="w-2 h-2 rounded-full bg-blue-500 mr-1"></span>
                                {repo.language}
                              </span>
                            )}
                            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                              {repo.stargazersCount}
                            </div>
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
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
