import React, { useState, useRef, useEffect } from 'react';

interface PromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  maxLength?: number;
  rows?: number;
}

export const PromptEditor: React.FC<PromptEditorProps> = ({
  value,
  onChange,
  placeholder = "Describe what you'd like to work on...",
  disabled = false,
  className = "",
  maxLength = 2000,
  rows = 6,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to get accurate scrollHeight
    textarea.style.height = 'auto';
    
    // Calculate new height based on content
    const newHeight = Math.max(
      textarea.scrollHeight,
      parseInt(getComputedStyle(textarea).lineHeight) * rows
    );
    
    // Set new height with reasonable limits
    textarea.style.height = `${Math.min(newHeight, 300)}px`;
  }, [value, rows]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (newValue.length <= maxLength) {
      onChange(newValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Allow Ctrl+Enter or Cmd+Enter to submit (can be handled by parent)
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      // Dispatch custom event that parent can listen for
      const submitEvent = new CustomEvent('promptSubmit', { detail: { value } });
      textareaRef.current?.dispatchEvent(submitEvent);
    }
  };

  const wordCount = value.trim().split(/\s+/).filter(word => word.length > 0).length;
  const charCount = value.length;

  return (
    <div className={`relative ${className}`}>
      {/* Header with label and counts */}
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center space-x-2">
          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <label className="text-base font-semibold text-gray-900 dark:text-white">
            Prompt
          </label>
        </div>
        <div className="flex space-x-3 text-xs">
          <div className="flex items-center space-x-1">
            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
            <span className="text-gray-600 dark:text-gray-400">{wordCount} words</span>
          </div>
          <div className="flex items-center space-x-1">
            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className={`${charCount > maxLength * 0.9 ? 'text-orange-500' : 'text-gray-600 dark:text-gray-400'}`}>
              {charCount}/{maxLength}
            </span>
          </div>
        </div>
      </div>

      {/* Textarea container with enhanced styling */}
      <div className={`
        relative border-2 rounded-xl transition-all duration-200 shadow-sm
        ${isFocused ? 'border-blue-500 ring-4 ring-blue-500/20' : 'border-gray-200 dark:border-gray-600'}
        ${disabled ? 'bg-gray-50 dark:bg-gray-900' : 'bg-white dark:bg-gray-800'}
      `}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
          className={`
            w-full px-4 py-3 resize-none border-0 rounded-xl
            focus:outline-none focus:ring-0
            bg-transparent text-gray-900 dark:text-gray-100
            disabled:text-gray-500 disabled:cursor-not-allowed
            placeholder-gray-500 dark:placeholder-gray-400
            text-sm leading-relaxed
          `}
          style={{ minHeight: `${rows * 1.75}rem` }}
        />

        {/* Character limit warning */}
        {charCount > maxLength * 0.8 && (
          <div className={`
            absolute bottom-2 right-2 px-2 py-1 text-xs rounded
            ${charCount > maxLength * 0.9 ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}
          `}>
            {maxLength - charCount} left
          </div>
        )}
      </div>

      {/* Footer with tips */}
      <div className="mt-2 text-xs text-gray-500 space-y-1">
        <div>
          💡 Be specific about what you want to build, fix, or explore
        </div>
        <div>
          ⌨️ Press Ctrl+Enter (Cmd+Enter on Mac) when ready
        </div>
      </div>


    </div>
  );
};

export default PromptEditor;
