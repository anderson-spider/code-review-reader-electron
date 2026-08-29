import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import {
  SettingsLayout,
  SettingsHeader,
  SettingsSidebar,
  GitLabSection,
  ProxySection,
  CodexSection,
  AppearanceSection,
  AboutSection,
} from '../components/settings';
import type { SettingsCategory, SaveMessage } from '../../shared/types';

const CATEGORY_TITLES: Record<SettingsCategory, string> = {
  gitlab: 'Configurações',
  proxy: 'Configurações',
  codex: 'Configurações',
  appearance: 'Configurações',
  about: 'Configurações',
};

/**
 * Full-page settings view with sidebar navigation.
 * Replaces the previous SettingsModal for better UX with complex settings.
 */
export function SettingsView() {
  const { setCurrentView } = useAppStore();
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('gitlab');
  const [message, setMessage] = useState<SaveMessage>(null);

  // Handle back navigation
  const handleBack = useCallback(() => {
    setCurrentView('main');
  }, [setCurrentView]);

  // Keyboard navigation (Escape to go back)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleBack]);

  // Handle messages from sections
  const handleMessage = useCallback((msg: SaveMessage) => {
    setMessage(msg);
    if (msg) {
      setTimeout(() => setMessage(null), 3000);
    }
  }, []);

  // Render active section
  const renderSection = () => {
    const props = { onMessage: handleMessage };

    switch (activeCategory) {
      case 'gitlab':
        return <GitLabSection {...props} />;
      case 'proxy':
        return <ProxySection {...props} />;
      case 'codex':
        return <CodexSection {...props} />;
      case 'appearance':
        return <AppearanceSection {...props} />;
      case 'about':
        return <AboutSection {...props} />;
      default:
        return <GitLabSection {...props} />;
    }
  };

  return (
    <>
      <SettingsLayout
        header={
          <SettingsHeader
            title={CATEGORY_TITLES[activeCategory]}
            onBack={handleBack}
          />
        }
        sidebar={
          <SettingsSidebar
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />
        }
        content={
          <>
            {message && (
              <div
                role={message.type === 'error' ? 'alert' : 'status'}
                aria-live={message.type === 'error' ? 'assertive' : 'polite'}
                aria-atomic="true"
                className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
                  message.type === 'success'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/80 dark:text-green-200'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/80 dark:text-red-200'
                }`}
              >
                {message.text}
              </div>
            )}
            {renderSection()}
          </>
        }
      />
    </>
  );
}
