import React, { useState, useEffect, useRef } from 'react';
import { useGitHub, Branch, Repository } from '../hooks/useGitHub';

interface BranchSelectorProps {
  repository: Repository | null;
  value?: string;
  onChange: (branch: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const BranchSelector: React.FC<BranchSelectorProps> = ({
  repository,
  value,
  onChange,
  placeholder = "Select branch...",
  disabled = false,
  className = "",
}) => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filteredBranches, setFilteredBranches] = useState<Branch[]>([]);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const { getBranches, loading, error } = useGitHub();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load branches when repository changes
  useEffect(() => {
    const loadBranches = async () => {
      if (!repository) {
        setBranches([]);
        setFilteredBranches([]);
        return;
      }

      try {
        const result = await getBranches(
          repository.owner.login,
          repository.name,
          { per_page: 100 } // Get more branches for better filtering
        );
        
        const branchList = result.data || [];
        setBranches(branchList);
        setFilteredBranches(branchList);
        
        // Auto-select default branch if no value is set
        if (!value && repository.defaultBranch) {
          onChange(repository.defaultBranch);
        }
      } catch (err) {
        console.error('Error loading branches:', err);
        setBranches([]);
        setFilteredBranches([]);
      }
    };

    loadBranches();
  }, [repository, getBranches, value, onChange]);

  // Filter branches based on query
  useEffect(() => {
    if (!query.trim()) {
      setFilteredBranches(branches);
    } else {
      const filtered = branches.filter(branch =>
        branch.name.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredBranches(filtered);
    }
    setSelectedIndex(-1);
  }, [query, branches]);

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
    
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  const handleInputFocus = () => {
    if (!isOpen && branches.length > 0) {
      setIsOpen(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredBranches.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < filteredBranches.length) {
          const selectedBranch = filteredBranches[selectedIndex];
          if (selectedBranch) {
            selectBranch(selectedBranch.name);
          }
        } else if (query && filteredBranches.length === 1) {
          const firstBranch = filteredBranches[0];
          if (firstBranch) {
            selectBranch(firstBranch.name);
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

  const selectBranch = (branchName: string) => {
    onChange(branchName);
    setQuery(branchName);
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
      setQuery(value);
    } else if (!isOpen) {
      setQuery('');
    }
  }, [value, isOpen]);

  const isDisabled = disabled || !repository || loading;

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
          placeholder={repository ? placeholder : "Select a repository first"}
          disabled={isDisabled}
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

        {!loading && !error && repository && (
          <div className="absolute right-3 top-2.5">
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        )}
      </div>

      {isOpen && repository && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {filteredBranches.length === 0 ? (
            <div className="px-3 py-2 text-gray-500 text-sm">
              {query ? 'No branches found' : 'No branches available'}
            </div>
          ) : (
            <ul ref={listRef} className="py-1">
              {filteredBranches.map((branch, index) => (
                <li
                  key={branch.name}
                  className={`
                    px-3 py-2 cursor-pointer hover:bg-gray-50
                    ${index === selectedIndex ? 'bg-blue-50 text-blue-700' : ''}
                  `}
                  onClick={() => selectBranch(branch.name)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414L2.586 7a2 2 0 010-2.828l3.707-3.707a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="font-mono text-sm">
                        {branch.name}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {branch.name === repository.defaultBranch && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                          default
                        </span>
                      )}
                      {branch.protected && (
                        <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
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

export default BranchSelector;
