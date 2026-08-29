import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sun, Moon, HelpCircle, Settings } from 'lucide-react';
import { useAppStore } from './store/appStore';
import { useLogStore } from './store/logStore';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { ReviewDisplayView } from './components/ReviewDisplayView';
import { EmptyState } from './components/EmptyState';
import { LoadingView } from './components/LoadingView';
import { ErrorView } from './components/ErrorView';
import { ReviewOptionsPanel } from './components/ReviewOptionsPanel';
import { MemoryContainerPicker, resolveMemoryProject } from './components/MemoryContainerPicker';
import { LogPanel } from './components/LogPanel';
import { SettingsView } from './views/SettingsView';
import type {
  MergeRequest,
  ParsedMRUrl,
  RepositoryProgress,
  ExpandedContext,
  MemoryContainer,
  MemoryContainerListStatus,
  MemorySettings,
} from '../shared/types';
import { DEFAULT_MEMORY_SETTINGS } from '../shared/types';

// Constants from APP_RULES.md
const MAX_FILES_WARNING = 50;

// Default token budget for expanded context (80K tokens, leaving room for response)
const DEFAULT_TOKEN_BUDGET = 80_000;

function App() {
  const {
    isConfigured,
    setConfigured,
    gitlabBaseURL,
    darkMode,
    toggleDarkMode,
    currentMR,
    currentReview,
    isLoading,
    errorMessage,
    reviewProgress,
    currentView,
    setCurrentView,
    setCurrentMR,
    setCurrentReview,
    setCurrentChanges,
    setLoading,
    setError,
    setParsedUrl,
    setReviewProgress,
  } = useAppStore();

  const [mrURL, setMrURL] = useState('');
  const [showSizeWarning, setShowSizeWarning] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [pendingMR, setPendingMR] = useState<{
    mr: MergeRequest;
    parsed: ParsedMRUrl;
    memoryContainerTag: string | null;
  } | null>(null);
  const [includeTests, setIncludeTests] = useState(false);
  const [repositoryProgress, setRepositoryProgress] = useState<RepositoryProgress | null>(null);
  const [memorySettings, setMemorySettings] = useState<MemorySettings>(DEFAULT_MEMORY_SETTINGS);
  const [memorySettingsReady, setMemorySettingsReady] = useState(false);
  const [memoryContainers, setMemoryContainers] = useState<MemoryContainer[]>([]);
  const [memoryStatus, setMemoryStatus] = useState<MemoryContainerListStatus>('ready');
  const [selectedMemoryTag, setSelectedMemoryTag] = useState('');
  const [refreshingMemory, setRefreshingMemory] = useState(false);
  const memoryProject = useMemo(() => resolveMemoryProject(mrURL), [mrURL]);
  const memoryWriteQueueRef = useRef<Promise<void>>(Promise.resolve());

  // Initialize app - check if GitLab token exists
  useEffect(() => {
    const initApp = async () => {
      try {
        const hasToken = await window.electronAPI.config.hasToken();
        if (hasToken) {
          await window.electronAPI.gitlab.init(gitlabBaseURL);
          setConfigured(true);
        }
      } catch (err) {
        console.error('Failed to initialize app:', err);
      }
    };

    initApp();
  }, [gitlabBaseURL, setConfigured]);

  useEffect(() => {
    window.electronAPI.config.getMemorySettings().then((settings) => {
      setMemorySettings(settings);
    }).catch(() => {
      setMemorySettings(DEFAULT_MEMORY_SETTINGS);
    }).finally(() => setMemorySettingsReady(true));
  }, []);

  const refreshMemoryContainers = useCallback(async () => {
    setRefreshingMemory(true);
    try {
      const result = await window.electronAPI.memory.listContainers();
      setMemoryContainers(result.containers);
      setMemoryStatus(result.status);
    } catch (error) {
      console.error('Failed to refresh Supermemory containers:', error);
      setMemoryContainers([]);
      setMemoryStatus('unavailable');
    } finally {
      setRefreshingMemory(false);
    }
  }, []);

  useEffect(() => {
    void refreshMemoryContainers();
  }, [refreshMemoryContainers]);

  useEffect(() => {
    if (!memoryProject) {
      setSelectedMemoryTag('');
      return;
    }
    const configured = memorySettings.projects.find((project) => project.projectUrl === memoryProject.projectUrl);
    if (configured) {
      setSelectedMemoryTag(configured.enabled ? configured.containerTag : '');
      return;
    }
    const matches = memoryContainers.filter((container) => container.containerTag.startsWith(memoryProject.tagPrefix));
    setSelectedMemoryTag(matches.length === 1 ? matches[0].containerTag : '');
  }, [memoryContainers, memoryProject, memorySettings.projects]);

  const persistMemorySelection = useCallback((projectUrl: string, containerTag: string) => {
    const save = async () => {
      const currentSettings = await window.electronAPI.config.getMemorySettings();
      const nextSettings = {
        ...currentSettings,
        projects: [
          ...currentSettings.projects.filter((project) => project.projectUrl !== projectUrl),
          { enabled: Boolean(containerTag), projectUrl, containerTag },
        ],
      };
      setMemorySettings(nextSettings);
      await window.electronAPI.config.setMemorySettings(nextSettings);
    };
    const operation = memoryWriteQueueRef.current.then(save, save);
    memoryWriteQueueRef.current = operation.catch(() => undefined);
    return operation;
  }, []);

  // Sync dark mode with document element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Listen for OS theme changes when app theme is set to "system"
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const appearance = useAppStore.getState().appearance;

    const handleChange = (e: MediaQueryListEvent) => {
      const currentAppearance = useAppStore.getState().appearance;
      if (currentAppearance.theme === 'system') {
        const currentDarkMode = useAppStore.getState().darkMode;
        if (e.matches !== currentDarkMode) {
          toggleDarkMode();
        }
      }
    };

    // Sync on mount if theme is "system"
    if (appearance.theme === 'system' && mediaQuery.matches !== darkMode) {
      toggleDarkMode();
    }

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for review progress events from main process
  useEffect(() => {
    const cleanup = window.electronAPI.onReviewProgress((progress) => {
      setReviewProgress(progress);
    });

    return cleanup;
  }, [setReviewProgress]);

  // Listen for repository progress events from main process
  useEffect(() => {
    const cleanup = window.electronAPI.onRepositoryProgress((progress) => {
      setRepositoryProgress(progress);
    });

    return cleanup;
  }, []);

  // Listen for log events from main process
  const addLog = useLogStore((state) => state.addLog);
  const resetLogState = useLogStore((state) => state.resetLogState);
  useEffect(() => {
    const cleanup = window.electronAPI.onLogEntry((entry) => {
      addLog(entry);
    });

    return cleanup;
  }, [addLog]);

  /**
   * Validate MR state per APP_RULES.md RN-VAL-001, RN-VAL-002, RN-VAL-003
   */
  const validateMR = (mr: MergeRequest): { valid: boolean; error?: string; warning?: string } => {
    // RN-VAL-001: State validation
    if (mr.state === 'merged') {
      return { valid: false, error: `MR !${mr.iid} already merged. Nothing to review.` };
    }
    if (mr.state === 'closed') {
      return { valid: false, error: `MR !${mr.iid} is closed. Nothing to review.` };
    }

    // RN-VAL-002: Conflict detection
    if (mr.has_conflicts || mr.merge_status === 'cannot_be_merged') {
      return { valid: false, error: `MR !${mr.iid} has conflicts. Please resolve conflicts before review.` };
    }

    // RN-VAL-003: Size warning (handled separately with confirmation)
    if (mr.changes_count && mr.changes_count > MAX_FILES_WARNING) {
      return { valid: true, warning: `MR has ${mr.changes_count} files. Large MRs may take longer to analyze.` };
    }

    return { valid: true };
  };

  /**
   * Continue with review after validation/confirmation
   * Fetches changes and generates the review
   */
  const continueWithReview = useCallback(async (
    mr: MergeRequest,
    parsed: ParsedMRUrl,
    memoryContainerTag: string | null,
  ) => {
    setCurrentMR(mr);
    setParsedUrl(parsed);

    let expandedContext: ExpandedContext | null = null;
    let repoPath: string | null = null;

    try {
      // Fetch changes
      const changes = await window.electronAPI.gitlab.fetchChanges(parsed.projectPath, parsed.mrIID);
      setCurrentChanges(changes);

      // Every review attempts a local checkout and fails open when it is unavailable.
      console.log('[App] Local checkout enabled, starting clone...');
      try {
        // Fetch project info to get SSH URL
        const project = await window.electronAPI.gitlab.fetchProject(parsed.projectPath);

        // Clone repository
        repoPath = await window.electronAPI.repository.clone(
          project.ssh_url_to_repo,
          mr.source_branch
        );

        // Build expanded context with token budget to prevent overflow
        expandedContext = await window.electronAPI.repository.readContext(repoPath, changes, {
          tokenBudget: DEFAULT_TOKEN_BUDGET,
          maxRelatedDepth: 2,
        });
      } catch (checkoutErr) {
        console.error('Local checkout failed, continuing without expanded context:', checkoutErr);
        setRepositoryProgress({
          stage: 'error',
          progress: 0,
          message: `Local checkout failed: ${checkoutErr instanceof Error ? checkoutErr.message : 'Unknown error'}`,
        });
      }

      // Generate review
      const review = await window.electronAPI.review.generateReview(
        mr,
        changes,
        includeTests,
        expandedContext,
        memoryContainerTag,
      );
      setCurrentReview(review);

      setLoading(false);
      setReviewProgress(null);
      setRepositoryProgress(null);
    } catch (err) {
      setLoading(false);
      setReviewProgress(null);
      setRepositoryProgress(null);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      // Cleanup: always remove temp directory if we created one
      if (repoPath) {
        try {
          await window.electronAPI.repository.cleanup(repoPath);
        } catch (cleanupErr) {
          console.error('Failed to cleanup temp directory:', cleanupErr);
        }
      }
    }
  }, [includeTests, setCurrentMR, setParsedUrl, setCurrentChanges, setCurrentReview, setLoading, setError, setReviewProgress]);

  // Handle MR URL submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mrURL.trim()) return;

    // Clear previous state
    setCurrentMR(null);
    setCurrentReview(null);
    setCurrentChanges(null);
    setError(null);
    resetLogState();
    setLoading(true);

    try {
      // Parse URL
      const parsed = await window.electronAPI.gitlab.parseURL(mrURL);

      // Fetch MR details
      const mr = await window.electronAPI.gitlab.fetchMR(parsed.projectPath, parsed.mrIID);
      const memoryContainerTag = selectedMemoryTag || null;
      if (memoryProject) {
        try {
          await persistMemorySelection(memoryProject.projectUrl, selectedMemoryTag);
        } catch (memoryError) {
          console.error('Failed to persist project memory selection:', memoryError);
        }
      }

      // Validate MR (RN-VAL-001, RN-VAL-002, RN-VAL-003)
      const validation = validateMR(mr);

      if (!validation.valid) {
        setLoading(false);
        setError(validation.error || 'MR validation failed');
        return;
      }

      // Show size warning dialog if needed (RN-VAL-003)
      if (validation.warning) {
        setPendingMR({ mr, parsed, memoryContainerTag });
        setShowSizeWarning(true);
        return; // Wait for user confirmation
      }

      // Continue with review
      await continueWithReview(mr, parsed, memoryContainerTag);
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    }
  }, [mrURL, selectedMemoryTag, memoryProject, persistMemorySelection, continueWithReview, setCurrentMR, setCurrentReview, setCurrentChanges, setError, setLoading, setPendingMR, setShowSizeWarning, resetLogState]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInputField = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

      // Cmd/Ctrl+D: Toggle dark mode
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        toggleDarkMode();
        return;
      }

      // Cmd/Ctrl+K or Cmd/Ctrl+?: Show keyboard shortcuts
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === '?')) {
        e.preventDefault();
        setShowShortcuts(true);
        return;
      }

      // Cmd/Ctrl+,: Show settings
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setCurrentView('settings');
        return;
      }

      // Cmd/Ctrl+Enter: Submit MR URL (when input focused)
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && isInputField) {
        e.preventDefault();
        if (mrURL.trim()) {
          handleSubmit({ preventDefault: () => {} } as React.FormEvent);
        }
        return;
      }

      // Cmd/Ctrl+R: Retry review (when error shown)
      if ((e.metaKey || e.ctrlKey) && e.key === 'r' && !isInputField) {
        e.preventDefault();
        if (errorMessage && mrURL.trim()) {
          setError(null);
          handleSubmit({ preventDefault: () => {} } as React.FormEvent);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleDarkMode, mrURL, errorMessage, setError, handleSubmit, setCurrentView]);

  // Handle size warning confirmation
  const handleSizeWarningConfirm = async () => {
    setShowSizeWarning(false);
    if (pendingMR) {
      await continueWithReview(pendingMR.mr, pendingMR.parsed, pendingMR.memoryContainerTag);
      setPendingMR(null);
    }
  };

  const handleSizeWarningCancel = () => {
    setShowSizeWarning(false);
    setPendingMR(null);
    setLoading(false);
  };

  // Determine content to show
  const renderContent = () => {
    if (isLoading) {
      return (
        <LoadingView
          progress={reviewProgress}
          repositoryProgress={repositoryProgress}
          message="Generating code review..."
        />
      );
    }

    if (errorMessage) {
      return (
        <ErrorView
          message={errorMessage}
          onRetry={() => {
            setError(null);
            if (mrURL.trim()) {
              handleSubmit({ preventDefault: () => {} } as React.FormEvent);
            }
          }}
        />
      );
    }

    if (currentReview) {
      return <ReviewDisplayView review={currentReview} onReviewUpdate={setCurrentReview} />;
    }

    return <EmptyState />;
  };

  // Render Settings View when currentView is 'settings'
  if (currentView === 'settings') {
    return <SettingsView />;
  }

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
      {/* Header - pt-7 adds space for macOS traffic light buttons, titlebar-drag-region enables window dragging */}
      <header className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pt-7 titlebar-drag-region">
        {/* Title Bar */}
        <div className="flex items-center justify-between px-4 py-2">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white select-none">
            Code Review Reader
          </h1>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              title={`${darkMode ? 'Light' : 'Dark'} Mode (Cmd+D)`}
            >
              {darkMode ? (
                <Sun className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              ) : (
                <Moon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              )}
            </button>
            <button
              onClick={() => setShowShortcuts(true)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Keyboard shortcuts"
              title="Keyboard Shortcuts (Cmd+K)"
            >
              <HelpCircle className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
            <button
              onClick={() => setCurrentView('settings')}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Settings"
              title="Settings (Cmd+,)"
            >
              <Settings className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
          </div>
        </div>

        {/* MR Input + Options */}
        <div className="px-4 pb-3">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="url"
              value={mrURL}
              onChange={(e) => setMrURL(e.target.value)}
              placeholder="Paste GitLab MR URL here..."
              disabled={isLoading}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!mrURL.trim() || isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 font-medium"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Analyzing...
                </>
              ) : (
                'Review'
              )}
            </button>
          </form>
          {/* Options inline */}
          <div className="mt-2 flex items-center justify-between">
            <div className="flex min-w-0 flex-1 items-end gap-4">
              <MemoryContainerPicker
                project={memoryProject}
                containers={memoryContainers}
                status={memoryStatus}
                value={selectedMemoryTag}
                refreshing={refreshingMemory}
                disabled={isLoading || !memorySettingsReady}
                onChange={(containerTag) => {
                  setSelectedMemoryTag(containerTag);
                  if (memoryProject) {
                    void persistMemorySelection(memoryProject.projectUrl, containerTag).catch((error) => {
                      console.error('Failed to persist project memory selection:', error);
                    });
                  }
                }}
                onRefresh={() => void refreshMemoryContainers()}
              />
              <ReviewOptionsPanel
                includeTests={includeTests}
                onIncludeTestsChange={setIncludeTests}
                disabled={isLoading}
              />
            </div>
            {currentMR && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                MR !{currentMR.iid}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Configuration Banner */}
      {!isConfigured && (
        <div className="mx-4 mt-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg flex items-center gap-2">
          <svg
            className="w-5 h-5 text-orange-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm text-orange-700 dark:text-orange-300">
            GitLab token not configured.
          </span>
          <button
            onClick={() => setCurrentView('settings')}
            className="text-sm text-orange-600 dark:text-orange-400 hover:underline font-medium"
          >
            Open Settings
          </button>
        </div>
      )}

      {/* Main Content - scrollable area */}
      <main className="flex-1 overflow-auto min-h-0">
        {renderContent()}
      </main>

      {/* Log Panel */}
      <LogPanel />

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />

      {/* Size Warning Dialog (RN-VAL-003) */}
      {showSizeWarning && pendingMR && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Large MR Warning
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              This MR contains <span className="font-semibold text-gray-900 dark:text-white">{pendingMR.mr.changes_count} files</span>.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
              Large MRs may take longer to analyze and could be truncated. Consider reviewing in smaller batches for better results.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleSizeWarningCancel}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSizeWarningConfirm}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Continue Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
