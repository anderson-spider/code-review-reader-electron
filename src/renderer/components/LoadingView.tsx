import { useState, useEffect } from 'react';
import type { ReviewProgress, ReviewStage, RepositoryProgress, RepositoryStage } from '../../shared/types';
import { THINKING_PHRASES } from '../../shared/types';

interface LoadingViewProps {
  progress?: ReviewProgress | null;
  repositoryProgress?: RepositoryProgress | null;
  message?: string;
}

/**
 * Get human-readable label for review stage
 */
function getStageLabel(stage: ReviewStage): string {
  const labels: Record<ReviewStage, string> = {
    filtering: 'Filtrando arquivos',
    preparing: 'Preparando análise',
    analyzing: 'Analisando código',
    parsing: 'Processando resultados',
    complete: 'Concluído',
    error: 'Erro',
  };
  return labels[stage] ?? stage;
}

/**
 * Get human-readable label for repository stage
 */
function getRepositoryStageLabel(stage: RepositoryStage): string {
  const labels: Record<RepositoryStage, string> = {
    cloning: 'Clonando repositório',
    reading: 'Lendo arquivos',
    'building-context': 'Construindo contexto',
    complete: 'Checkout completo',
    error: 'Erro no checkout',
  };
  return labels[stage] ?? stage;
}

export function LoadingView({ progress, repositoryProgress, message = 'Carregando...' }: LoadingViewProps) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [simulatedProgress, setSimulatedProgress] = useState(0);

  // Rotate thinking phrases every 4 seconds during 'analyzing' stage
  useEffect(() => {
    if (progress?.stage !== 'analyzing') return;

    const interval = setInterval(() => {
      setPhraseIndex((i) => (i + 1) % THINKING_PHRASES.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [progress?.stage]);

  // Simulate progress during 'analyzing' stage (increment ~1% every 2 seconds)
  useEffect(() => {
    if (progress?.stage !== 'analyzing') {
      setSimulatedProgress(progress?.progress ?? 0);
      return;
    }

    // Start from current progress
    setSimulatedProgress(progress.progress);

    const interval = setInterval(() => {
      setSimulatedProgress((p) => Math.min(p + 1, 90)); // Cap at 90% until real completion
    }, 2000);

    return () => clearInterval(interval);
  }, [progress?.stage, progress?.progress]);

  // Calculate display progress
  const displayProgress =
    progress?.stage === 'analyzing'
      ? Math.max(progress.progress, simulatedProgress)
      : progress?.progress ?? 0;

  // Determine current message to show
  const currentPhrase =
    progress?.stage === 'analyzing'
      ? THINKING_PHRASES[phraseIndex]
      : progress?.currentMessage ?? message;

  // If no progress info, show simple loading
  if (!progress) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        {/* Spinner */}
        <div className="relative w-16 h-16 mb-4">
          <div className="absolute inset-0 border-4 border-blue-200 dark:border-blue-800 rounded-full" />
          <div className="absolute inset-0 border-4 border-transparent border-t-blue-600 rounded-full animate-spin" />
        </div>

        {/* Message */}
        <p className="text-gray-600 dark:text-gray-400 text-center animate-pulse">{message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      {/* Spinner */}
      <div className="relative w-16 h-16 mb-6">
        <div className="absolute inset-0 border-4 border-blue-200 dark:border-blue-800 rounded-full" />
        <div className="absolute inset-0 border-4 border-transparent border-t-blue-600 rounded-full animate-spin" />
      </div>

      {/* Title */}
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Revisando Merge Request
      </h2>

      {/* Progress Bar */}
      <div className="w-full max-w-md mb-6">
        <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-1">
          <span>{getStageLabel(progress.stage)}</span>
          <span>{displayProgress}%</span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${displayProgress}%` }}
          />
        </div>
      </div>

      {/* Repository Progress (Local Checkout) */}
      {repositoryProgress && repositoryProgress.stage !== 'complete' && (
        <div className="w-full max-w-md mb-4">
          <div className="flex items-center gap-2 mb-2 text-sm text-gray-600 dark:text-gray-400">
            <span>📦</span>
            <span>Checkout Local</span>
          </div>
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>{getRepositoryStageLabel(repositoryProgress.stage)}</span>
              <span>{repositoryProgress.progress}%</span>
            </div>
            <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  repositoryProgress.stage === 'error'
                    ? 'bg-red-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${repositoryProgress.progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 truncate">
              {repositoryProgress.message}
            </p>
          </div>
        </div>
      )}

      {/* Files List */}
      {progress.files && progress.files.length > 0 && (
        <div className="w-full max-w-md mb-6">
          <div className="flex items-center gap-2 mb-2 text-sm text-gray-600 dark:text-gray-400">
            <span>📁</span>
            <span>Arquivos para análise</span>
          </div>
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 max-h-40 overflow-y-auto">
            <ul className="space-y-1">
              {progress.files.map((file) => (
                <li key={file} className="text-sm text-gray-700 dark:text-gray-300 font-mono truncate">
                  <span className="text-gray-400 mr-2">•</span>
                  {file}
                </li>
              ))}
            </ul>
          </div>
          {progress.filteredCount > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {progress.filteredCount} arquivo(s) filtrado(s) (testes, binários, etc.)
            </p>
          )}
        </div>
      )}

      {/* Thinking Phrase */}
      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
        <span>💭</span>
        <p className="animate-pulse">{currentPhrase}</p>
      </div>
    </div>
  );
}
