import { PromptProfileEditor } from '../PromptProfileEditor';
import type { SettingsSectionProps } from '../../../../shared/types';
import { MemorySettingsEditor } from '../MemorySettingsEditor';

export function CodexSection({ onMessage }: SettingsSectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Codex App Server
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Configure o Codex usado para analisar Merge Requests e personalize seus prompts.
        </p>
      </div>

      <div className="flex items-start gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
        <div>
          <h3 className="font-medium text-emerald-800 dark:text-emerald-200">Usando Codex App Server</h3>
          <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
            O app inicia <code className="font-mono">codex app-server</code> localmente. Confirme a sessão com <code className="font-mono">codex login status</code>.
          </p>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <MemorySettingsEditor onMessage={onMessage} />
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <PromptProfileEditor onSaveMessage={(message) => onMessage?.(message)} />
      </div>
    </div>
  );
}
