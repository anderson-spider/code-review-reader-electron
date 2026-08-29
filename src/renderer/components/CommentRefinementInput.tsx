import { useState, useRef, useEffect, useCallback } from 'react';

interface CommentRefinementInputProps {
  onRefine: (instructions: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export function CommentRefinementInput({
  onRefine,
  onCancel,
  isLoading,
}: CommentRefinementInputProps) {
  const [instructions, setInstructions] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(() => {
    if (instructions.trim() && !isLoading) {
      onRefine(instructions.trim());
    }
  }, [instructions, isLoading, onRefine]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Submit on Ctrl+Enter or Cmd+Enter
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();
        handleSubmit();
      }
      // Cancel on Escape
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    },
    [handleSubmit, onCancel]
  );

  const isSubmitDisabled = !instructions.trim() || isLoading;

  return (
    <div className="mt-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800">
      <textarea
        ref={textareaRef}
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
        placeholder="Enter refinement instructions (e.g., 'Make it more concise', 'Add code example')"
        aria-label="Refinement instructions"
        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg
                   bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                   placeholder-gray-500 dark:placeholder-gray-400
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                   disabled:opacity-50 disabled:cursor-not-allowed
                   resize-none"
        rows={2}
      />

      <div className="flex justify-end gap-2 mt-2">
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg
                     text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700
                     hover:bg-gray-50 dark:hover:bg-gray-600
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitDisabled}
          aria-busy={isLoading}
          className="px-3 py-1.5 text-sm rounded-lg text-white
                     bg-blue-600 hover:bg-blue-700
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Refining...
            </>
          ) : (
            'Refine'
          )}
        </button>
      </div>

      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        Press Ctrl+Enter to submit, Escape to cancel
      </p>
    </div>
  );
}
