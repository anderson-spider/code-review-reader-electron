import { useAppStore } from '../../../store/appStore';
import type { ThemePreference, FontSize, SettingsSectionProps } from '../../../../shared/types';

const themeOptions: { value: ThemePreference; label: string; description: string }[] = [
  { value: 'system', label: 'Sistema', description: 'Segue o tema do sistema operacional' },
  { value: 'light', label: 'Claro', description: 'Sempre usar tema claro' },
  { value: 'dark', label: 'Escuro', description: 'Sempre usar tema escuro' },
];

const fontSizeOptions: { value: FontSize; label: string; description: string }[] = [
  { value: 'small', label: 'Pequena', description: 'Texto compacto' },
  { value: 'medium', label: 'Média', description: 'Tamanho padrão' },
  { value: 'large', label: 'Grande', description: 'Texto maior para melhor leitura' },
];

/**
 * Appearance settings section.
 * Handles theme and font size preferences.
 */
export function AppearanceSection({ onMessage }: SettingsSectionProps) {
  const { appearance, setAppearance, darkMode, toggleDarkMode } = useAppStore();

  const handleThemeChange = (theme: ThemePreference) => {
    setAppearance({ theme });

    // Also update darkMode for backward compatibility
    if (theme === 'dark') {
      if (!darkMode) toggleDarkMode();
    } else if (theme === 'light') {
      if (darkMode) toggleDarkMode();
    } else if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark !== darkMode) toggleDarkMode();
    }

    onMessage?.({ type: 'success', text: 'Tema atualizado' });
  };

  const handleFontSizeChange = (fontSize: FontSize) => {
    setAppearance({ fontSize });
    onMessage?.({ type: 'success', text: 'Tamanho da fonte atualizado' });
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Aparência
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Personalize a aparência visual do aplicativo.
        </p>
      </div>

      {/* Theme Selection */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Tema
        </label>
        <div className="space-y-2">
          {themeOptions.map((option) => (
            <label
              key={option.value}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                appearance.theme === option.value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <input
                type="radio"
                name="theme"
                value={option.value}
                checked={appearance.theme === option.value}
                onChange={() => handleThemeChange(option.value)}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {option.label}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {option.description}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Font Size Selection */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Tamanho da Fonte
        </label>
        <div className="space-y-2">
          {fontSizeOptions.map((option) => (
            <label
              key={option.value}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                appearance.fontSize === option.value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <input
                type="radio"
                name="fontSize"
                value={option.value}
                checked={appearance.fontSize === option.value}
                onChange={() => handleFontSizeChange(option.value)}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {option.label}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {option.description}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Preview Note */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
        <svg
          className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        <div className="text-sm text-amber-700 dark:text-amber-300">
          <p>
            O tamanho da fonte será aplicado em uma versão futura.
          </p>
        </div>
      </div>
    </div>
  );
}
