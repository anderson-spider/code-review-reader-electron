import { useState, useEffect } from 'react';
import { ExternalLink, Github, Heart } from 'lucide-react';
import type { SettingsSectionProps } from '../../../../shared/types';

/**
 * About section with app information, version, and links.
 */
export function AboutSection({ onMessage: _onMessage }: SettingsSectionProps) {
  const [appVersion, setAppVersion] = useState<string>('');
  const [platform, setPlatform] = useState<string>('');

  useEffect(() => {
    // Load app info
    window.electronAPI.app.getVersion().then(setAppVersion);
    window.electronAPI.app.getPlatform().then(setPlatform);
  }, []);

  const openExternal = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Sobre
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Informações sobre o aplicativo.
        </p>
      </div>

      {/* App Info Card */}
      <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              Code Review Reader
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              GitLab MR code review com Codex
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Versão</span>
            <p className="font-medium text-gray-900 dark:text-white">
              {appVersion || 'Carregando...'}
            </p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Plataforma</span>
            <p className="font-medium text-gray-900 dark:text-white capitalize">
              {platform || 'Carregando...'}
            </p>
          </div>
        </div>
      </div>

      {/* Links */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Links Úteis
        </h3>

        <button
          onClick={() => openExternal('https://github.com/seu-usuario/code-review-reader-electron')}
          className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
        >
          <Github className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              Repositório GitHub
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Código fonte e documentação
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-gray-400" />
        </button>

        <button
          onClick={() => openExternal('https://github.com/seu-usuario/code-review-reader-electron/issues')}
          className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
        >
          <svg
            className="w-5 h-5 text-gray-600 dark:text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              Reportar Problema
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Bugs e sugestões de melhoria
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-gray-400" />
        </button>

        <button
          onClick={() => openExternal('https://docs.gitlab.com/ee/api/')}
          className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
        >
          <svg
            className="w-5 h-5 text-gray-600 dark:text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              Documentação GitLab API
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Referência da API utilizada
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Credits */}
      <div className="flex items-center justify-center gap-2 pt-4 text-sm text-gray-500 dark:text-gray-400">
        <span>Feito com</span>
        <Heart className="w-4 h-4 text-red-500 fill-current" />
        <span>usando Electron, React e Codex</span>
      </div>
    </div>
  );
}
