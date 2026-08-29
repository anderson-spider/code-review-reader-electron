import type { ReactNode } from 'react';

interface SettingsLayoutProps {
  sidebar: ReactNode;
  header: ReactNode;
  content: ReactNode;
}

/**
 * Settings page layout with sidebar navigation pattern.
 * Uses CSS Grid for responsive sidebar/content layout.
 */
export function SettingsLayout({ sidebar, header, content }: SettingsLayoutProps) {
  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
      {/* Header with back button */}
      <header className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pt-7 titlebar-drag-region">
        {header}
      </header>

      {/* Main content area with sidebar */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Sidebar navigation */}
        <aside className="w-full md:w-56 flex-shrink-0 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-x-auto md:overflow-y-auto">
          {sidebar}
        </aside>

        {/* Content area */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto p-4 sm:p-6">
            {content}
          </div>
        </main>
      </div>
    </div>
  );
}
