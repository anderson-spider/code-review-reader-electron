interface ReviewOptionsPanelProps {
  includeTests: boolean;
  onIncludeTestsChange: (value: boolean) => void;
  disabled?: boolean;
}

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
  description: string;
}

function Toggle({ checked, onChange, disabled, label, description }: ToggleProps) {
  return (
    <label
      className={`flex items-center gap-2 cursor-pointer select-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={description}
    >
      <div className="relative inline-flex items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only peer"
        />
        <div className="w-9 h-5 bg-gray-200 dark:bg-gray-600 rounded-full peer peer-checked:bg-blue-500 transition-colors" />
        <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-4" />
      </div>
      <span className="text-sm text-gray-700 dark:text-gray-300">
        {label}
      </span>
    </label>
  );
}

export function ReviewOptionsPanel({
  includeTests,
  onIncludeTestsChange,
  disabled = false,
}: ReviewOptionsPanelProps) {
  return (
    <div className="flex items-center gap-4">
      <Toggle
        checked={includeTests}
        onChange={onIncludeTestsChange}
        disabled={disabled}
        label="Include Tests"
        description="Analyze test files in the review"
      />
      <span
        className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300"
        title="Every review attempts a local checkout and continues without it if cloning fails"
      >
        Local Checkout · Always on
      </span>
    </div>
  );
}
