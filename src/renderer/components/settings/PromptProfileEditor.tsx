import { useState, useEffect } from 'react';
import type { PromptProfile, PromptConfig } from '../../../shared/types';
import { DEFAULT_CUSTOM_INSTRUCTIONS } from '../../../shared/types';
import { v4 as uuidv4 } from 'uuid';

interface PromptProfileEditorProps {
  onSaveMessage: (message: { type: 'success' | 'error'; text: string }) => void;
}

export function PromptProfileEditor({ onSaveMessage }: PromptProfileEditorProps) {
  const [config, setConfig] = useState<PromptConfig | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('default');
  const [editedInstructions, setEditedInstructions] = useState('');
  const [editedName, setEditedName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Load prompt config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const promptConfig = await window.electronAPI.config.getPromptConfig();
      setConfig(promptConfig);
      setSelectedProfileId(promptConfig.activeProfileId);

      const activeProfile = promptConfig.profiles.find((p) => p.id === promptConfig.activeProfileId);
      if (activeProfile) {
        setEditedInstructions(activeProfile.customInstructions);
        setEditedName(activeProfile.name);
      }
    } catch (error) {
      console.error('Failed to load prompt config:', error);
    }
  };

  const handleProfileSelect = (profileId: string) => {
    if (!config) return;

    setSelectedProfileId(profileId);
    setIsCreatingNew(false);

    const profile = config.profiles.find((p) => p.id === profileId);
    if (profile) {
      setEditedInstructions(profile.customInstructions);
      setEditedName(profile.name);
    }
  };

  const handleCreateNew = () => {
    setIsCreatingNew(true);
    setSelectedProfileId('');
    setEditedName('');
    setEditedInstructions(DEFAULT_CUSTOM_INSTRUCTIONS);
  };

  const handleSave = async () => {
    if (!config) return;

    setIsLoading(true);
    try {
      if (isCreatingNew) {
        // Create new profile
        const newProfile: PromptProfile = {
          id: uuidv4(),
          name: editedName.trim() || 'Novo Perfil',
          customInstructions: editedInstructions,
        };

        await window.electronAPI.config.savePromptProfile(newProfile);
        await window.electronAPI.config.setActivePromptProfile(newProfile.id);

        setIsCreatingNew(false);
        setSelectedProfileId(newProfile.id);
        onSaveMessage({ type: 'success', text: `Perfil "${newProfile.name}" criado` });
      } else {
        // Update existing profile
        const existingProfile = config.profiles.find((p) => p.id === selectedProfileId);
        if (existingProfile) {
          const updatedProfile: PromptProfile = {
            ...existingProfile,
            name: selectedProfileId === 'default' ? existingProfile.name : editedName.trim() || existingProfile.name,
            customInstructions: editedInstructions,
          };

          await window.electronAPI.config.savePromptProfile(updatedProfile);
          onSaveMessage({ type: 'success', text: 'Perfil salvo' });
        }
      }

      await loadConfig();
    } catch (error) {
      onSaveMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erro ao salvar perfil',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivate = async () => {
    if (!selectedProfileId || isCreatingNew) return;

    setIsLoading(true);
    try {
      await window.electronAPI.config.setActivePromptProfile(selectedProfileId);
      await loadConfig();
      onSaveMessage({ type: 'success', text: 'Perfil ativado' });
    } catch (error) {
      onSaveMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erro ao ativar perfil',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedProfileId || selectedProfileId === 'default' || isCreatingNew) return;

    setIsLoading(true);
    try {
      await window.electronAPI.config.deletePromptProfile(selectedProfileId);
      await loadConfig();
      setSelectedProfileId('default');
      onSaveMessage({ type: 'success', text: 'Perfil excluído' });
    } catch (error) {
      onSaveMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erro ao excluir perfil',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetToDefault = () => {
    setEditedInstructions(DEFAULT_CUSTOM_INSTRUCTIONS);
  };

  if (!config) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
      </div>
    );
  }

  const currentProfile = config.profiles.find((p) => p.id === selectedProfileId);
  const isActive = config.activeProfileId === selectedProfileId;
  const hasChanges =
    isCreatingNew ||
    (currentProfile &&
      (currentProfile.customInstructions !== editedInstructions ||
        (selectedProfileId !== 'default' && currentProfile.name !== editedName)));

  return (
    <div className="space-y-4">
      {/* Profile Selector */}
      <div>
        <label htmlFor="prompt-profile" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Perfil de Prompt
        </label>
        <div className="flex gap-2">
          <select
            id="prompt-profile"
            value={isCreatingNew ? '' : selectedProfileId}
            onChange={(e) => handleProfileSelect(e.target.value)}
            disabled={isCreatingNew}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
          >
            {config.profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name} {config.activeProfileId === profile.id ? '(Ativo)' : ''}
              </option>
            ))}
          </select>
          <button
            onClick={handleCreateNew}
            disabled={isCreatingNew}
            className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Criar novo perfil"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Profile Name (editable for non-default profiles) */}
      {(isCreatingNew || selectedProfileId !== 'default') && (
        <div>
          <label htmlFor="prompt-profile-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Nome do Perfil
          </label>
          <input
            id="prompt-profile-name"
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            placeholder="Ex: Foco em Segurança"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
      )}

      {/* Custom Instructions Editor */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="prompt-custom-instructions" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Instruções Customizadas
          </label>
          <button
            onClick={handleResetToDefault}
            className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Restaurar Padrão
          </button>
        </div>
        <textarea
          id="prompt-custom-instructions"
          value={editedInstructions}
          onChange={(e) => setEditedInstructions(e.target.value)}
          rows={12}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm resize-y"
          placeholder="Instruções para o review..."
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Personalize o comportamento, foco e regras de linguagem do revisor.
        </p>
      </div>

      {/* Info Box */}
      <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
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
          <p className="font-medium">Partes fixas do prompt:</p>
          <p className="mt-1">
            As <strong>diretrizes de severidade</strong> (critical, warning, suggestion, info) e o{' '}
            <strong>formato JSON de resposta</strong> são fixos e serão adicionados automaticamente.
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-2">
        <button
          onClick={handleSave}
          disabled={isLoading || !hasChanges}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Salvando...' : isCreatingNew ? 'Criar Perfil' : 'Salvar'}
        </button>

        {!isCreatingNew && !isActive && (
          <button
            onClick={handleActivate}
            disabled={isLoading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Ativar
          </button>
        )}

        {!isCreatingNew && selectedProfileId !== 'default' && (
          <button
            onClick={handleDelete}
            disabled={isLoading}
            className="px-4 py-2 text-red-600 hover:text-red-700 dark:text-red-400"
          >
            Excluir
          </button>
        )}

        {isCreatingNew && (
          <button
            onClick={() => {
              setIsCreatingNew(false);
              handleProfileSelect(config.activeProfileId);
            }}
            disabled={isLoading}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 dark:text-gray-400"
          >
            Cancelar
          </button>
        )}
      </div>

      {/* Active Profile Indicator */}
      {!isCreatingNew && isActive && (
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span>Este perfil está ativo e será usado nas próximas análises</span>
        </div>
      )}
    </div>
  );
}
