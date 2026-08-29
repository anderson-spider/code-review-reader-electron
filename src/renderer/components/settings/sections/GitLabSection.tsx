import { useState, useEffect } from 'react';
import { useAppStore } from '../../../store/appStore';
import type { SettingsSectionProps } from '../../../../shared/types';

/**
 * GitLab API settings section.
 * Handles base URL configuration and personal access token management.
 */
export function GitLabSection({ onMessage }: SettingsSectionProps) {
  const { gitlabBaseURL, setGitlabBaseURL, setConfigured } = useAppStore();

  const [gitlabToken, setGitlabToken] = useState('');
  const [hasExistingToken, setHasExistingToken] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check for existing token on mount
  useEffect(() => {
    window.electronAPI.config.hasToken().then((has) => {
      setHasExistingToken(has);
    });
  }, []);

  // Save GitLab token
  const handleSaveToken = async () => {
    if (!gitlabToken.trim()) return;

    setIsLoading(true);
    try {
      await window.electronAPI.config.saveToken(gitlabToken);
      await window.electronAPI.gitlab.reinit(gitlabBaseURL);
      setHasExistingToken(true);
      setGitlabToken('');
      setConfigured(true);
      onMessage?.({ type: 'success', text: 'Token do GitLab salvo com sucesso' });
    } catch (error) {
      onMessage?.({
        type: 'error',
        text: error instanceof Error ? error.message : 'Falha ao salvar token',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Delete GitLab token
  const handleDeleteToken = async () => {
    setIsLoading(true);
    try {
      await window.electronAPI.config.deleteToken();
      setHasExistingToken(false);
      setConfigured(false);
      onMessage?.({ type: 'success', text: 'Token removido' });
    } catch (error) {
      onMessage?.({
        type: 'error',
        text: error instanceof Error ? error.message : 'Falha ao remover token',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          GitLab API
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Configure a conexão com o GitLab para buscar Merge Requests.
        </p>
      </div>

      {/* Base URL */}
      <div className="space-y-2">
        <label
          htmlFor="gitlab-url"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          URL Base da API
        </label>
        <input
          id="gitlab-url"
          type="url"
          value={gitlabBaseURL}
          onChange={(e) => setGitlabBaseURL(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="https://gitlab.com/api/v4"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Padrão: https://gitlab.com/api/v4
        </p>
      </div>

      {/* Personal Access Token */}
      <div className="space-y-2">
        <label
          htmlFor="gitlab-token"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Personal Access Token
        </label>
        <input
          id="gitlab-token"
          type="password"
          value={gitlabToken}
          onChange={(e) => setGitlabToken(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="glpat-xxxxxxxxxxxxx"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Escopos necessários: read_api, read_repository
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSaveToken}
          disabled={!gitlabToken.trim() || isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Salvando...' : 'Salvar Token'}
        </button>

        {hasExistingToken && (
          <>
            <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-sm">Token salvo</span>
            </div>
            <button
              onClick={handleDeleteToken}
              disabled={isLoading}
              className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
            >
              Remover
            </button>
          </>
        )}
      </div>

      {/* Info Box */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <svg
          className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
        <div className="text-sm text-blue-700 dark:text-blue-300">
          <p>
            Crie um token em <strong>Settings → Access Tokens</strong> no GitLab.
          </p>
          <p className="mt-1">
            O token é armazenado de forma segura no Keychain do sistema.
          </p>
        </div>
      </div>
    </div>
  );
}
