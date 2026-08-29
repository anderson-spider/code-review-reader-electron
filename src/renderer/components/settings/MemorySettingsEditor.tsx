import { useEffect, useState } from 'react';
import type { MemorySettings, SaveMessage } from '../../../shared/types';
import { DEFAULT_MEMORY_SETTINGS } from '../../../shared/types';

export function MemorySettingsEditor({ onMessage }: { onMessage?: (message: SaveMessage) => void }) {
  const [settings, setSettings] = useState<MemorySettings>(DEFAULT_MEMORY_SETTINGS);

  useEffect(() => {
    window.electronAPI.config.getMemorySettings().then(setSettings).catch(() => {
      onMessage?.({ type: 'error', text: 'Não foi possível carregar a configuração de memória.' });
    });
  }, [onMessage]);

  const save = async () => {
    try {
      await window.electronAPI.config.setMemorySettings(settings);
      onMessage?.({ type: 'success', text: 'Ferramentas de memória salvas.' });
    } catch {
      onMessage?.({ type: 'error', text: 'Revise os caminhos dos binários de memória.' });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium text-gray-900 dark:text-white">Project memory tools</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Os containers são escolhidos na tela principal. A autenticação permanece nos CLIs locais.
        </p>
      </div>
      <label className="block text-sm text-gray-700 dark:text-gray-300">
        SMFS binary
        <input
          aria-label="SMFS binary"
          className="mt-1 w-full rounded-md border px-3 py-2 dark:bg-gray-800 dark:border-gray-600"
          value={settings.smfsBinaryPath}
          onChange={(event) => setSettings({ ...settings, smfsBinaryPath: event.target.value })}
        />
      </label>
      <label className="block text-sm text-gray-700 dark:text-gray-300">
        Supermemory binary
        <input
          aria-label="Supermemory binary"
          className="mt-1 w-full rounded-md border px-3 py-2 dark:bg-gray-800 dark:border-gray-600"
          value={settings.supermemoryBinaryPath}
          onChange={(event) => setSettings({ ...settings, supermemoryBinaryPath: event.target.value })}
        />
      </label>
      <button
        type="button"
        className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
        onClick={save}
      >
        Save memory tools
      </button>
    </div>
  );
}
