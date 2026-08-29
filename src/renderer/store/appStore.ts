import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  MergeRequest,
  CodeReview,
  FileChange,
  ParsedMRUrl,
  ReviewProgress,
  AppView,
  AppearanceSettings,
  Severity,
} from '../../shared/types';
import { DEFAULT_APPEARANCE_SETTINGS } from '../../shared/types';

// -----------------------------------------------------------------------------
// State Types
// -----------------------------------------------------------------------------

interface AppState {
  // Configuration (persisted)
  gitlabBaseURL: string;
  lastMRURL: string;
  darkMode: boolean;
  appearance: AppearanceSettings;

  // Navigation (NOT persisted)
  currentView: AppView;

  // Runtime state
  isConfigured: boolean;
  currentMR: MergeRequest | null;
  currentChanges: FileChange[] | null;
  parsedUrl: ParsedMRUrl | null;
  currentReview: CodeReview | null;
  isLoading: boolean;
  loadingMessage: string;
  errorMessage: string | null;
  reviewProgress: ReviewProgress | null;

  // Settings actions
  setGitlabBaseURL: (url: string) => void;
  setLastMRURL: (url: string) => void;
  toggleDarkMode: () => void;
  setAppearance: (settings: Partial<AppearanceSettings>) => void;

  // Navigation actions
  setCurrentView: (view: AppView) => void;

  // App state actions
  setConfigured: (configured: boolean) => void;
  setCurrentMR: (mr: MergeRequest | null) => void;
  setCurrentChanges: (changes: FileChange[] | null) => void;
  setParsedUrl: (parsed: ParsedMRUrl | null) => void;
  setCurrentReview: (review: CodeReview | null) => void;
  setLoading: (loading: boolean, message?: string) => void;
  setError: (error: string | null) => void;
  setReviewProgress: (progress: ReviewProgress | null) => void;

  // Comment actions
  updateCommentSeverity: (id: string, severity: Severity) => void;

  // Complex actions
  reset: () => void;
  resetReview: () => void;
}

// -----------------------------------------------------------------------------
// Initial State
// -----------------------------------------------------------------------------

const initialState = {
  // Configuration
  gitlabBaseURL: 'https://gitlab.com/api/v4',
  lastMRURL: '',
  darkMode: typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false,
  appearance: DEFAULT_APPEARANCE_SETTINGS,

  // Navigation (NOT persisted - always start at main)
  currentView: 'main' as AppView,

  // Runtime state
  isConfigured: false,
  currentMR: null,
  currentChanges: null,
  parsedUrl: null,
  currentReview: null,
  isLoading: false,
  loadingMessage: '',
  errorMessage: null,
  reviewProgress: null,
};

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      ...initialState,

      // Settings actions
      setGitlabBaseURL: (url) => set({ gitlabBaseURL: url }),
      setLastMRURL: (url) => set({ lastMRURL: url }),
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
      setAppearance: (settings) =>
        set((state) => ({
          appearance: { ...state.appearance, ...settings },
        })),

      // Navigation actions
      setCurrentView: (view) => set({ currentView: view }),

      // App state actions
      setConfigured: (configured) => set({ isConfigured: configured }),
      setCurrentMR: (mr) => set({ currentMR: mr }),
      setCurrentChanges: (changes) => set({ currentChanges: changes }),
      setParsedUrl: (parsed) => set({ parsedUrl: parsed }),
      setCurrentReview: (review) => set({ currentReview: review }),
      setLoading: (loading, message = '') =>
        set({ isLoading: loading, loadingMessage: message }),
      setError: (error) => set({ errorMessage: error }),
      setReviewProgress: (progress) => set({ reviewProgress: progress }),

      // Comment actions
      updateCommentSeverity: (id, severity) =>
        set((state) => ({
          currentReview: state.currentReview
            ? {
                ...state.currentReview,
                comments: state.currentReview.comments.map((comment) =>
                  comment.id === id ? { ...comment, severity } : comment
                ),
              }
            : null,
        })),

      // Complex actions
      reset: () =>
        set({
          currentMR: null,
          currentChanges: null,
          parsedUrl: null,
          currentReview: null,
          isLoading: false,
          loadingMessage: '',
          errorMessage: null,
          reviewProgress: null,
        }),

      resetReview: () =>
        set({
          currentReview: null,
          errorMessage: null,
        }),
    }),
    {
      name: 'code-review-reader-storage',
      storage: createJSONStorage(() => localStorage),
      // Only persist these settings (NOT currentView - always start at 'main')
      partialize: (state) => ({
        gitlabBaseURL: state.gitlabBaseURL,
        lastMRURL: state.lastMRURL,
        darkMode: state.darkMode,
        appearance: state.appearance,
      }),
    }
  )
);

// -----------------------------------------------------------------------------
// Selectors (for computed values)
// -----------------------------------------------------------------------------

export const selectHasReview = (state: AppState) => state.currentReview !== null;
