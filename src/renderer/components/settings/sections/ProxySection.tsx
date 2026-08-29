import { useState, useEffect } from 'react';
import { useAppStore } from '../../../store/appStore';
import type { ProxySettings, ProxyType, SettingsSectionProps } from '../../../../shared/types';

const DEFAULT_PROXY: ProxySettings = {
  enabled: false,
  type: 'none',
  host: '',
  port: 1080,
};

/**
 * Proxy settings section.
 * Handles network proxy configuration for GitLab API requests.
 */
export function ProxySection({ onMessage }: SettingsSectionProps) {
  const { gitlabBaseURL } = useAppStore();

  const [proxySettings, setProxySettings] = useState<ProxySettings>(DEFAULT_PROXY);
  const [isLoading, setIsLoading] = useState(false);

  // Load proxy settings on mount
  useEffect(() => {
    window.electronAPI.config.getProxySettings().then((settings) => {
      setProxySettings(settings);
    });
  }, []);

  // Update proxy field
  const updateProxy = (field: keyof ProxySettings, value: ProxySettings[keyof ProxySettings]) => {
    setProxySettings((prev) => ({ ...prev, [field]: value }));
  };

  // Save proxy settings
  const handleSaveProxy = async () => {
    setIsLoading(true);
    try {
      await window.electronAPI.config.setProxySettings(proxySettings);
      await window.electronAPI.gitlab.reinit(gitlabBaseURL);
      onMessage?.({ type: 'success', text: 'Configurações de proxy salvas' });
    } catch (error) {
      onMessage?.({
        type: 'error',
        text: error instanceof Error ? error.message : 'Falha ao salvar proxy',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Reset proxy settings
  const handleResetProxy = async () => {
    setIsLoading(true);
    try {
      await window.electronAPI.config.resetProxySettings();
      setProxySettings(DEFAULT_PROXY);
      await window.electronAPI.gitlab.reinit(gitlabBaseURL);
      onMessage?.({ type: 'success', text: 'Configurações de proxy resetadas' });
    } catch (error) {
      onMessage?.({
        type: 'error',
        text: error instanceof Error ? error.message : 'Falha ao resetar proxy',
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
          Configurações de Proxy
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Configure um proxy para as requisições à API do GitLab.
        </p>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Habilitar Proxy
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Usar servidor proxy para requisições ao GitLab
          </p>
        </div>
        <button
          onClick={() => updateProxy('enabled', !proxySettings.enabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            proxySettings.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
          }`}
          role="switch"
          aria-checked={proxySettings.enabled}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              proxySettings.enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Proxy Type */}
      <div className="space-y-2">
        <label
          htmlFor="proxy-type"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Tipo de Proxy
        </label>
        <select
          id="proxy-type"
          value={proxySettings.type}
          onChange={(e) => updateProxy('type', e.target.value as ProxyType)}
          disabled={!proxySettings.enabled}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="none">Nenhum</option>
          <option value="socks5">SOCKS5</option>
          <option value="http">HTTP/HTTPS</option>
        </select>
      </div>

      {/* Host */}
      <div className="space-y-2">
        <label
          htmlFor="proxy-host"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Host
        </label>
        <input
          id="proxy-host"
          type="text"
          value={proxySettings.host}
          onChange={(e) => updateProxy('host', e.target.value)}
          disabled={!proxySettings.enabled}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="127.0.0.1 ou proxy.example.com"
        />
      </div>

      {/* Port */}
      <div className="space-y-2">
        <label
          htmlFor="proxy-port"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Porta
        </label>
        <input
          id="proxy-port"
          type="number"
          value={proxySettings.port}
          onChange={(e) => updateProxy('port', parseInt(e.target.value, 10) || 0)}
          disabled={!proxySettings.enabled}
          min={1}
          max={65535}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="1080"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSaveProxy}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Salvando...' : 'Salvar Configurações'}
        </button>
        <button
          onClick={handleResetProxy}
          disabled={isLoading}
          className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50 transition-colors"
        >
          Restaurar Padrão
        </button>
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
          <p>O proxy é usado apenas para requisições à API do GitLab.</p>
          <p className="mt-1">O GitHub CLI usa sua própria configuração de rede.</p>
        </div>
      </div>
    </div>
  );
}
