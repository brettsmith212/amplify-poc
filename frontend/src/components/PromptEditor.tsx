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
        <label className="block text-sm font-medium text-gray-700">
          Prompt
        </label>
        <div className="flex space-x-4 text-xs text-gray-500">
          <span>{wordCount} words</span>
          <span className={charCount > maxLength * 0.9 ? 'text-orange-500' : ''}>
            {charCount}/{maxLength}
          </span>
        </div>
      </div>

      {/* Textarea container with enhanced styling */}
      <div className={`
        relative border rounded-md transition-all duration-200
        ${isFocused ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-20' : 'border-gray-300'}
        ${disabled ? 'bg-gray-50' : 'bg-white'}
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
            w-full px-3 py-2 resize-none border-0 rounded-md
            focus:outline-none focus:ring-0
            disabled:bg-gray-50 disabled:text-gray-500
            placeholder-gray-400
            text-sm leading-relaxed
          `}
          style={{ minHeight: `${rows * 1.5}rem` }}
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

      {/* Syntax highlighting suggestions (simple implementation) */}
      {value && (
        <div className="mt-3 p-3 bg-gray-50 rounded-md border">
          <div className="text-xs font-medium text-gray-700 mb-2">
            Detected Context:
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Simple keyword detection for common programming terms */}
            {['bug', 'fix', 'error'].some(keyword => 
              value.toLowerCase().includes(keyword)
            ) && (
              <span className="inline-flex items-center px-2 py-1 text-xs bg-red-100 text-red-700 rounded">
                🐛 Bug Fix
              </span>
            )}
            
            {['feature', 'add', 'implement', 'create'].some(keyword => 
              value.toLowerCase().includes(keyword)
            ) && (
              <span className="inline-flex items-center px-2 py-1 text-xs bg-green-100 text-green-700 rounded">
                ✨ New Feature
              </span>
            )}
            
            {['refactor', 'improve', 'optimize', 'clean'].some(keyword => 
              value.toLowerCase().includes(keyword)
            ) && (
              <span className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                🔧 Refactoring
              </span>
            )}
            
            {['test', 'testing', 'spec', 'unit', 'integration'].some(keyword => 
              value.toLowerCase().includes(keyword)
            ) && (
              <span className="inline-flex items-center px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded">
                🧪 Testing
              </span>
            )}
            
            {['document', 'docs', 'readme', 'comment'].some(keyword => 
              value.toLowerCase().includes(keyword)
            ) && (
              <span className="inline-flex items-center px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded">
                📝 Documentation
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PromptEditor;
