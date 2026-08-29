import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '../../store/appStore';
import { useLogStore } from '../../store/logStore';
import {
  mockOpenMR,
  mockMergedMR,
  mockClosedMR,
  mockConflictMR,
  mockLargeMR,
  mockParsedUrl,
  createMockReview,
  mockModifiedFile,
} from '@/test/fixtures';

// ---------------------------------------------------------------------------
// Mock child components to isolate App logic
// ---------------------------------------------------------------------------
vi.mock('../ReviewDisplayView', () => ({
  ReviewDisplayView: ({ review }: { review: { summary: string } }) => (
    <div data-testid="review-display">{review?.summary}</div>
  ),
}));

vi.mock('../LogPanel', () => ({
  LogPanel: () => <div data-testid="log-panel">LogPanel</div>,
}));

vi.mock('../../views/SettingsView', () => ({
  SettingsView: () => <div data-testid="settings-view">Settings</div>,
}));

vi.mock('../EmptyState', () => ({
  EmptyState: () => <div data-testid="empty-state">Empty</div>,
}));

vi.mock('../LoadingView', () => ({
  LoadingView: ({ message }: { message: string }) => (
    <div data-testid="loading-view">{message}</div>
  ),
}));

vi.mock('../ErrorView', () => ({
  ErrorView: ({ message, onRetry }: { message: string; onRetry: () => void }) => (
    <div data-testid="error-view">
      <span>{message}</span>
      <button onClick={onRetry}>Retry</button>
    </div>
  ),
}));

vi.mock('../KeyboardShortcutsModal', () => ({
  KeyboardShortcutsModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="shortcuts-modal">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

vi.mock('../ReviewOptionsPanel', () => ({
  ReviewOptionsPanel: () => <div data-testid="review-options">Options</div>,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reset both Zustand stores to initial state */
const resetStores = () => {
  useAppStore.setState({
    isConfigured: false,
    gitlabBaseURL: 'https://gitlab.com/api/v4',
    darkMode: false,
    appearance: { theme: 'system', fontSize: 'medium' },
    currentView: 'main',
    currentMR: null,
    currentChanges: null,
    parsedUrl: null,
    currentReview: null,
    isLoading: false,
    loadingMessage: '',
    errorMessage: null,
    reviewProgress: null,
    lastMRURL: '',
  });
  useLogStore.getState().resetLogState();
};

const mockReview = createMockReview();
const mockExpandedContext = {
  changedFiles: [],
  relatedFiles: [],
  projectStructure: { directories: [], fileCount: 0, tree: '' },
  repoPath: '/tmp/code-review-reader/repo',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('App', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();

    // Default: token exists
    window.electronAPI.config.hasToken = vi.fn().mockResolvedValue(true);
    window.electronAPI.gitlab.init = vi.fn().mockResolvedValue(undefined);
    window.electronAPI.gitlab.parseURL = vi.fn().mockResolvedValue(mockParsedUrl);
    window.electronAPI.gitlab.fetchMR = vi.fn().mockResolvedValue(mockOpenMR);
    window.electronAPI.gitlab.fetchChanges = vi.fn().mockResolvedValue([mockModifiedFile]);
    window.electronAPI.gitlab.fetchProject = vi.fn().mockResolvedValue({
      ssh_url_to_repo: 'git@gitlab.com:ns/proj.git',
    });
    window.electronAPI.review.generateReview = vi.fn().mockResolvedValue(mockReview);
    window.electronAPI.repository.clone = vi.fn().mockResolvedValue('/tmp/code-review-reader/repo');
    window.electronAPI.repository.readContext = vi.fn().mockResolvedValue(mockExpandedContext);
    window.electronAPI.repository.cleanup = vi.fn().mockResolvedValue(undefined);
    window.electronAPI.config.getMemorySettings = vi.fn().mockResolvedValue({
      smfsBinaryPath: 'smfs',
      supermemoryBinaryPath: 'supermemory',
      projects: [],
    });
    window.electronAPI.config.setMemorySettings = vi.fn().mockResolvedValue(undefined);
    window.electronAPI.memory.listContainers = vi.fn().mockResolvedValue({
      status: 'ready',
      containers: [],
    });
    window.electronAPI.onReviewProgress = vi.fn().mockReturnValue(vi.fn());
    window.electronAPI.onRepositoryProgress = vi.fn().mockReturnValue(vi.fn());
    window.electronAPI.onLogEntry = vi.fn().mockReturnValue(vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // We need dynamic import to apply mocks before component loads
  const renderApp = async () => {
    const { default: App } = await import('../../App');
    return render(<App />);
  };

  // =========================================================================
  // 1. Initialization
  // =========================================================================
  describe('Initialization', () => {
    it('should call config.hasToken on mount', async () => {
      await renderApp();
      await waitFor(() => {
        expect(window.electronAPI.config.hasToken).toHaveBeenCalledTimes(1);
      });
    });

    it('should initialize gitlab when token exists', async () => {
      window.electronAPI.config.hasToken = vi.fn().mockResolvedValue(true);
      await renderApp();
      await waitFor(() => {
        expect(window.electronAPI.gitlab.init).toHaveBeenCalledWith('https://gitlab.com/api/v4');
      });
    });

    it('should not initialize gitlab when no token', async () => {
      window.electronAPI.config.hasToken = vi.fn().mockResolvedValue(false);
      await renderApp();
      // Wait for async init to resolve
      await waitFor(() => {
        expect(window.electronAPI.config.hasToken).toHaveBeenCalled();
      });
      expect(window.electronAPI.gitlab.init).not.toHaveBeenCalled();
    });

    it('should show configuration banner when not configured', async () => {
      window.electronAPI.config.hasToken = vi.fn().mockResolvedValue(false);
      useAppStore.setState({ isConfigured: false });
      await renderApp();
      // hasToken returns false → setConfigured never called → banner stays visible
      await waitFor(() => {
        expect(window.electronAPI.config.hasToken).toHaveBeenCalled();
      });
      expect(screen.getByText('GitLab token not configured.')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 2. Theme / Dark Mode
  // =========================================================================
  describe('Dark mode sync', () => {
    it('should add dark class to documentElement when darkMode is true', async () => {
      // Use non-system theme to prevent the OS-sync effect from toggling
      useAppStore.setState({ darkMode: true, appearance: { theme: 'dark', fontSize: 'medium' } });
      await renderApp();
      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });
    });

    it('should remove dark class from documentElement when darkMode is false', async () => {
      document.documentElement.classList.add('dark');
      useAppStore.setState({ darkMode: false, appearance: { theme: 'light', fontSize: 'medium' } });
      await renderApp();
      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(false);
      });
    });

    it('should toggle dark mode when theme button is clicked', async () => {
      // Start with darkMode true (matches OS mock) to avoid system-sync toggle
      useAppStore.setState({ darkMode: true, appearance: { theme: 'dark', fontSize: 'medium' } });
      await renderApp();
      // darkMode=true → aria-label is "Switch to light mode"
      const button = screen.getByLabelText('Switch to light mode');
      await userEvent.click(button);
      expect(useAppStore.getState().darkMode).toBe(false);
    });
  });

  // =========================================================================
  // 3. IPC Event Listeners
  // =========================================================================
  describe('IPC event listeners', () => {
    it('should register review progress listener on mount', async () => {
      await renderApp();
      expect(window.electronAPI.onReviewProgress).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should register repository progress listener on mount', async () => {
      await renderApp();
      expect(window.electronAPI.onRepositoryProgress).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should register log entry listener on mount', async () => {
      await renderApp();
      expect(window.electronAPI.onLogEntry).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should call cleanup functions on unmount', async () => {
      const cleanupReview = vi.fn();
      const cleanupRepo = vi.fn();
      const cleanupLog = vi.fn();
      window.electronAPI.onReviewProgress = vi.fn().mockReturnValue(cleanupReview);
      window.electronAPI.onRepositoryProgress = vi.fn().mockReturnValue(cleanupRepo);
      window.electronAPI.onLogEntry = vi.fn().mockReturnValue(cleanupLog);

      const { unmount } = await renderApp();
      unmount();

      expect(cleanupReview).toHaveBeenCalled();
      expect(cleanupRepo).toHaveBeenCalled();
      expect(cleanupLog).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 4. View Routing
  // =========================================================================
  describe('View routing', () => {
    it('should show EmptyState when no MR is loaded', async () => {
      await renderApp();
      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });
    });

    it('should show LoadingView when loading', async () => {
      useAppStore.setState({ isLoading: true });
      await renderApp();
      expect(screen.getByTestId('loading-view')).toBeInTheDocument();
    });

    it('should show ErrorView when error occurs', async () => {
      useAppStore.setState({ errorMessage: 'Something went wrong' });
      await renderApp();
      expect(screen.getByTestId('error-view')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('should show ReviewDisplayView when review is available', async () => {
      useAppStore.setState({ currentReview: mockReview });
      await renderApp();
      expect(screen.getByTestId('review-display')).toBeInTheDocument();
      expect(screen.getByText(mockReview.summary)).toBeInTheDocument();
    });

    it('should show SettingsView when currentView is settings', async () => {
      useAppStore.setState({ currentView: 'settings' });
      await renderApp();
      expect(screen.getByTestId('settings-view')).toBeInTheDocument();
      // Should NOT show the main layout
      expect(screen.queryByText('Code Review Reader')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // 5. MR Validation (via URL submission)
  // =========================================================================
  describe('MR validation', () => {
    const submitURL = async (url = 'https://gitlab.com/ns/proj/-/merge_requests/123') => {
      await renderApp();
      const input = screen.getByPlaceholderText('Paste GitLab MR URL here...');
      await userEvent.clear(input);
      await userEvent.type(input, url);
      const button = screen.getByRole('button', { name: 'Review' });
      await userEvent.click(button);
    };

    it('should show error for merged MR', async () => {
      window.electronAPI.gitlab.fetchMR = vi.fn().mockResolvedValue(mockMergedMR);
      await submitURL();
      await waitFor(() => {
        expect(useAppStore.getState().errorMessage).toContain('already merged');
      });
    });

    it('should show error for closed MR', async () => {
      window.electronAPI.gitlab.fetchMR = vi.fn().mockResolvedValue(mockClosedMR);
      await submitURL();
      await waitFor(() => {
        expect(useAppStore.getState().errorMessage).toContain('is closed');
      });
    });

    it('should show error for MR with conflicts', async () => {
      window.electronAPI.gitlab.fetchMR = vi.fn().mockResolvedValue(mockConflictMR);
      await submitURL();
      await waitFor(() => {
        expect(useAppStore.getState().errorMessage).toContain('has conflicts');
      });
    });

    it('should show size warning dialog for large MR (>50 changes)', async () => {
      window.electronAPI.gitlab.fetchMR = vi.fn().mockResolvedValue(mockLargeMR);
      await submitURL();
      await waitFor(() => {
        expect(screen.getByText('Large MR Warning')).toBeInTheDocument();
        expect(screen.getByText(/100 files/)).toBeInTheDocument();
      });
    });

    it('should cancel large MR review when Cancel is clicked', async () => {
      window.electronAPI.gitlab.fetchMR = vi.fn().mockResolvedValue(mockLargeMR);
      await submitURL();
      await waitFor(() => {
        expect(screen.getByText('Large MR Warning')).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await userEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText('Large MR Warning')).not.toBeInTheDocument();
        expect(useAppStore.getState().isLoading).toBe(false);
      });
    });

    it('should continue review when Continue Anyway is clicked on size warning', async () => {
      window.electronAPI.gitlab.fetchMR = vi.fn().mockResolvedValue(mockLargeMR);
      await submitURL();
      await waitFor(() => {
        expect(screen.getByText('Large MR Warning')).toBeInTheDocument();
      });

      const continueButton = screen.getByRole('button', { name: 'Continue Anyway' });
      await userEvent.click(continueButton);

      await waitFor(() => {
        expect(window.electronAPI.gitlab.fetchChanges).toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  // 6. URL Submission Flow
  // =========================================================================
  describe('URL submission flow', () => {
    const submitURL = async (url = 'https://gitlab.com/ns/proj/-/merge_requests/123') => {
      await renderApp();
      const input = screen.getByPlaceholderText('Paste GitLab MR URL here...');
      await userEvent.clear(input);
      await userEvent.type(input, url);
      const button = screen.getByRole('button', { name: 'Review' });
      await userEvent.click(button);
    };

    it('should call parseURL, fetchMR, fetchChanges, generateReview in sequence', async () => {
      await submitURL();
      await waitFor(() => {
        expect(window.electronAPI.gitlab.parseURL).toHaveBeenCalledWith(
          'https://gitlab.com/ns/proj/-/merge_requests/123'
        );
      });
      await waitFor(() => {
        expect(window.electronAPI.gitlab.fetchMR).toHaveBeenCalledWith(
          mockParsedUrl.projectPath,
          mockParsedUrl.mrIID
        );
      });
      await waitFor(() => {
        expect(window.electronAPI.gitlab.fetchChanges).toHaveBeenCalledWith(
          mockParsedUrl.projectPath,
          mockParsedUrl.mrIID
        );
      });
      await waitFor(() => {
        expect(window.electronAPI.review.generateReview).toHaveBeenCalled();
      });
    });

    it('always checks out the repository and cleans it after review', async () => {
      await submitURL();

      await waitFor(() => {
        expect(window.electronAPI.repository.clone).toHaveBeenCalledWith(
          'git@gitlab.com:ns/proj.git',
          mockOpenMR.source_branch,
        );
      });
      expect(window.electronAPI.repository.readContext).toHaveBeenCalledWith(
        '/tmp/code-review-reader/repo',
        [mockModifiedFile],
        { tokenBudget: 80_000, maxRelatedDepth: 2 },
      );
      expect(window.electronAPI.review.generateReview).toHaveBeenCalledWith(
        mockOpenMR,
        [mockModifiedFile],
        false,
        mockExpandedContext,
        null,
      );
      expect(window.electronAPI.repository.cleanup).toHaveBeenCalledWith('/tmp/code-review-reader/repo');
    });

    it('fails open when local checkout is unavailable', async () => {
      window.electronAPI.repository.clone = vi.fn().mockRejectedValue(new Error('SSH unavailable'));
      await submitURL();

      await waitFor(() => {
        expect(window.electronAPI.review.generateReview).toHaveBeenCalledWith(
          mockOpenMR,
          [mockModifiedFile],
          false,
          null,
          null,
        );
      });
      expect(useAppStore.getState().currentReview).toEqual(mockReview);
      expect(window.electronAPI.repository.cleanup).not.toHaveBeenCalled();
    });

    it('cleans the checkout when review generation fails', async () => {
      window.electronAPI.review.generateReview = vi.fn().mockRejectedValue(new Error('Review failed'));
      await submitURL();

      await waitFor(() => {
        expect(useAppStore.getState().errorMessage).toBe('Review failed');
      });
      expect(window.electronAPI.repository.cleanup).toHaveBeenCalledWith('/tmp/code-review-reader/repo');
    });

    it('auto-selects and persists the unique project memory container', async () => {
      const tag = 'repo_sample_project__af210bf76d508742';
      vi.mocked(window.electronAPI.config.getMemorySettings)
        .mockResolvedValueOnce({
          smfsBinaryPath: 'smfs',
          supermemoryBinaryPath: 'supermemory',
          projects: [],
        })
        .mockResolvedValue({
          smfsBinaryPath: '/new/smfs',
          supermemoryBinaryPath: '/new/supermemory',
          projects: [{
            enabled: true,
            projectUrl: 'https://gitlab.example.com/group/existing',
            containerTag: 'repo_existing__123',
          }],
        });
      window.electronAPI.memory.listContainers = vi.fn().mockResolvedValue({
        status: 'ready',
        containers: [{
          containerTag: tag,
          name: 'Agents · sample-project',
          documentCount: 53,
          memoryCount: 218,
        }],
      });
      await renderApp();
      const input = screen.getByPlaceholderText('Paste GitLab MR URL here...');
      await userEvent.type(
        input,
        'https://gitlab.example.com/example-org/sample-project/-/merge_requests/42',
      );
      await waitFor(() => {
        expect(screen.getByLabelText('Project memory container')).toHaveValue(tag);
      });
      await userEvent.click(screen.getByRole('button', { name: 'Review' }));

      await waitFor(() => {
        expect(window.electronAPI.config.setMemorySettings).toHaveBeenCalledWith(expect.objectContaining({
          smfsBinaryPath: '/new/smfs',
          supermemoryBinaryPath: '/new/supermemory',
          projects: [
            {
              enabled: true,
              projectUrl: 'https://gitlab.example.com/group/existing',
              containerTag: 'repo_existing__123',
            },
            {
              enabled: true,
              projectUrl: 'https://gitlab.example.com/example-org/sample-project',
              containerTag: tag,
            },
          ],
        }));
      });
      expect(window.electronAPI.review.generateReview).toHaveBeenCalledWith(
        mockOpenMR,
        [mockModifiedFile],
        false,
        mockExpandedContext,
        tag,
      );
    });

    it('should set error when parseURL fails', async () => {
      window.electronAPI.gitlab.parseURL = vi.fn().mockRejectedValue(new Error('Invalid URL'));
      await submitURL();
      await waitFor(() => {
        expect(useAppStore.getState().errorMessage).toBe('Invalid URL');
      });
    });

    it('should set error when fetchMR fails', async () => {
      window.electronAPI.gitlab.fetchMR = vi.fn().mockRejectedValue(new Error('MR not found'));
      await submitURL();
      await waitFor(() => {
        expect(useAppStore.getState().errorMessage).toBe('MR not found');
      });
    });

    it('should set error when generateReview fails', async () => {
      window.electronAPI.review.generateReview = vi.fn().mockRejectedValue(
        new Error('Codex App Server not found')
      );
      await submitURL();
      await waitFor(() => {
        expect(useAppStore.getState().errorMessage).toBe('Codex App Server not found');
      });
    });

    it('should not submit when URL input is empty', async () => {
      await renderApp();
      const button = screen.getByRole('button', { name: 'Review' });
      expect(button).toBeDisabled();
    });

    it('should disable submit button while loading', async () => {
      useAppStore.setState({ isLoading: true });
      await renderApp();
      const button = screen.getByRole('button', { name: 'Analyzing...' });
      expect(button).toBeDisabled();
    });
  });

  // =========================================================================
  // 7. Keyboard Shortcuts
  // =========================================================================
  describe('Keyboard shortcuts', () => {
    it('should toggle dark mode with Ctrl+D', async () => {
      // Use non-system theme to prevent OS-sync from toggling on mount
      useAppStore.setState({ darkMode: false, appearance: { theme: 'light', fontSize: 'medium' } });
      await renderApp();
      fireEvent.keyDown(window, { key: 'd', ctrlKey: true });
      expect(useAppStore.getState().darkMode).toBe(true);
    });

    it('should open shortcuts modal with Ctrl+K', async () => {
      await renderApp();
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
      await waitFor(() => {
        expect(screen.getByTestId('shortcuts-modal')).toBeInTheDocument();
      });
    });

    it('should open settings with Ctrl+,', async () => {
      await renderApp();
      fireEvent.keyDown(window, { key: ',', ctrlKey: true });
      expect(useAppStore.getState().currentView).toBe('settings');
    });
  });

  // =========================================================================
  // 8. Header UI
  // =========================================================================
  describe('Header', () => {
    it('should render the app title', async () => {
      await renderApp();
      expect(screen.getByText('Code Review Reader')).toBeInTheDocument();
    });

    it('should open settings view when settings button is clicked', async () => {
      await renderApp();
      const button = screen.getByLabelText('Settings');
      await userEvent.click(button);
      expect(useAppStore.getState().currentView).toBe('settings');
    });

    it('should open shortcuts modal when help button is clicked', async () => {
      await renderApp();
      const button = screen.getByLabelText('Keyboard shortcuts');
      await userEvent.click(button);
      expect(screen.getByTestId('shortcuts-modal')).toBeInTheDocument();
    });

    it('should show current MR iid when a MR is loaded', async () => {
      useAppStore.setState({ currentMR: mockOpenMR });
      await renderApp();
      expect(screen.getByText(`MR !${mockOpenMR.iid}`)).toBeInTheDocument();
    });
  });
});
