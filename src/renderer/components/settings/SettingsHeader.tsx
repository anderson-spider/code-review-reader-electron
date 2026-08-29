import { ArrowLeft } from 'lucide-react';

interface SettingsHeaderProps {
  title: string;
  onBack: () => void;
}

/**
 * Settings page header with back button and title.
 */
export function SettingsHeader({ title, onBack }: SettingsHeaderProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <button
        onClick={onBack}
        className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label="Voltar"
        title="Voltar (Esc)"
      >
        <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
      </button>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-white select-none">
        {title}
      </h1>
    </div>
  );
}
