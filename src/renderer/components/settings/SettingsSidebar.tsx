import { Server, Globe, Brain, Palette, Info } from 'lucide-react';
import type { SettingsCategory } from '../../../shared/types';

interface SettingsSidebarProps {
  activeCategory: SettingsCategory;
  onCategoryChange: (category: SettingsCategory) => void;
}

interface CategoryItem {
  id: SettingsCategory;
  label: string;
  icon: typeof Server;
  description: string;
}

const connectionCategories: CategoryItem[] = [
  {
    id: 'gitlab',
    label: 'GitLab',
    icon: Server,
    description: 'API e autenticação',
  },
  {
    id: 'proxy',
    label: 'Proxy',
    icon: Globe,
    description: 'Configurações de rede',
  },
  {
    id: 'codex',
    label: 'Codex',
    icon: Brain,
    description: 'App Server e prompts',
  },
];

const preferenceCategories: CategoryItem[] = [
  {
    id: 'appearance',
    label: 'Aparência',
    icon: Palette,
    description: 'Tema e fonte',
  },
  {
    id: 'about',
    label: 'Sobre',
    icon: Info,
    description: 'Versão e informações',
  },
];

/**
 * Settings sidebar navigation component.
 * Groups categories into Connection and Preferences sections.
 */
export function SettingsSidebar({ activeCategory, onCategoryChange }: SettingsSidebarProps) {
  const renderCategory = (category: CategoryItem) => {
    const Icon = category.icon;
    const isActive = activeCategory === category.id;

    return (
      <button
        key={category.id}
        onClick={() => onCategoryChange(category.id)}
        className={`w-auto md:w-full flex-shrink-0 flex items-center gap-2 md:gap-3 px-3 py-2.5 text-left rounded-lg transition-colors ${
          isActive
            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-l-2 border-blue-600 dark:border-blue-400 -ml-[2px]'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
        }`}
        aria-current={isActive ? 'page' : undefined}
      >
        <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`} />
        <div className="min-w-0">
          <div className={`text-sm font-medium ${isActive ? 'text-blue-700 dark:text-blue-300' : ''}`}>
            {category.label}
          </div>
          <div className="hidden md:block text-xs text-gray-500 dark:text-gray-400 truncate">
            {category.description}
          </div>
        </div>
      </button>
    );
  };

  return (
    <nav className="flex gap-1 overflow-x-auto p-3 md:block md:space-y-6 md:overflow-visible" aria-label="Categorias de configuração">
      {/* Connection section */}
      <div className="contents md:block">
        <h2 className="hidden md:block px-3 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Conexão
        </h2>
        <div className="contents md:block md:space-y-1">
          {connectionCategories.map(renderCategory)}
        </div>
      </div>

      {/* Separator */}
      <div className="hidden md:block border-t border-gray-200 dark:border-gray-700" />

      {/* Preferences section */}
      <div className="contents md:block">
        <h2 className="hidden md:block px-3 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Preferências
        </h2>
        <div className="contents md:block md:space-y-1">
          {preferenceCategories.map(renderCategory)}
        </div>
      </div>
    </nav>
  );
}
