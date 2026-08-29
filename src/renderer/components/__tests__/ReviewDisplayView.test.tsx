import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReviewDisplayView } from '../ReviewDisplayView';
import { useAppStore } from '../../store/appStore';
import {
  createMockReview,
  createMockComment,
  mockCriticalComment,
  mockInfoComment,
  mockApprovableReview,
} from '../../../test/fixtures/reviews';
import { mockOpenMR, mockParsedUrl } from '../../../test/fixtures/mr-data';
import { mockModifiedFile } from '../../../test/fixtures/file-changes';

vi.mock('../../store/appStore', () => ({
  useAppStore: vi.fn(),
}));

const mockUseAppStore = vi.mocked(useAppStore);

// Save original DOM function at module scope (before any spies)
const nativeCreateElement = Document.prototype.createElement;

const defaultStoreValues = {
  currentMR: mockOpenMR,
  parsedUrl: mockParsedUrl,
  currentChanges: [mockModifiedFile],
  gitlabBaseURL: 'https://gitlab.com/api/v4',
  updateCommentSeverity: vi.fn(),
};

function setupStore(overrides: Partial<typeof defaultStoreValues> = {}) {
  const values = { ...defaultStoreValues, ...overrides };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockUseAppStore.mockReturnValue(values as any);
  return values;
}

// Track active download mock spies for cleanup
let downloadMockCleanup: (() => void) | null = null;

/**
 * Sets up mocks for file download flow. MUST be called AFTER render().
 * Returns a captured blob ref and a restore function.
 */
function setupDownloadMocks() {
  const mockLink = { href: '', download: '', click: vi.fn() };
  let capturedBlob: Blob | null = null;

  const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(
    function (this: Document, tag: string, options?: ElementCreationOptions) {
      if (tag === 'a') return mockLink as unknown as HTMLAnchorElement;
      return nativeCreateElement.call(this, tag, options);
    },
  );

  const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
  const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
  const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation((obj) => {
    if (obj instanceof Blob) capturedBlob = obj;
    return 'blob:mock';
  });
  const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

  function restore() {
    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
    downloadMockCleanup = null;
  }

  downloadMockCleanup = restore;

  return {
    mockLink,
    getCapturedBlob: () => capturedBlob,
    async readCapturedJSON(): Promise<Record<string, unknown>> {
      if (!capturedBlob) throw new Error('No blob captured');
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(capturedBlob!);
      });
      return JSON.parse(text);
    },
    restore,
  };
}

describe('ReviewDisplayView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStore();

    window.electronAPI.gitlab.fetchExistingComments = vi.fn().mockResolvedValue([]);
    window.electronAPI.gitlab.postComment = vi.fn().mockResolvedValue(undefined);
    window.electronAPI.gitlab.postLineComment = vi.fn().mockResolvedValue(undefined);
    window.electronAPI.gitlab.deleteMyComments = vi.fn().mockResolvedValue(3);
    window.electronAPI.gitlab.approveMR = vi.fn().mockResolvedValue(undefined);
    window.electronAPI.review.refineComment = vi.fn().mockResolvedValue({
      refinedComment: 'Refined comment',
      refinedCodeSnippet: null,
    });
  });

  afterEach(() => {
    // Ensure download mocks are always cleaned up
    if (downloadMockCleanup) downloadMockCleanup();
  });

  // ===========================================================================
  // Component Rendering
  // ===========================================================================

  describe('Component Rendering', () => {
    it('should render review summary', () => {
      const review = createMockReview();
      render(<ReviewDisplayView review={review} />);

      expect(screen.getByText('Summary')).toBeInTheDocument();
      expect(screen.getByText(review.summary)).toBeInTheDocument();
    });

    it('should render overall assessment', () => {
      const review = createMockReview();
      render(<ReviewDisplayView review={review} />);

      expect(screen.getByText('Overall Assessment')).toBeInTheDocument();
      expect(screen.getByText(review.overallAssessment)).toBeInTheDocument();
    });

    it('should group comments by file', () => {
      const review = createMockReview({
        comments: [
          createMockComment({ id: 'c1', filePath: 'src/a.ts', lineNumber: 1, severity: 'warning' }),
          createMockComment({ id: 'c2', filePath: 'src/b.ts', lineNumber: 2, severity: 'critical' }),
          createMockComment({ id: 'c3', filePath: 'src/a.ts', lineNumber: 5, severity: 'suggestion' }),
        ],
      });
      render(<ReviewDisplayView review={review} />);

      expect(screen.getByText('src/a.ts')).toBeInTheDocument();
      expect(screen.getByText('src/b.ts')).toBeInTheDocument();
    });

    it('should render MR info header when currentMR exists', () => {
      const review = createMockReview();
      render(<ReviewDisplayView review={review} />);

      expect(screen.getByText(`MR !${mockOpenMR.iid}: ${mockOpenMR.title}`)).toBeInTheDocument();
    });

    it('should show selection controls for postable comments', () => {
      const review = createMockReview();
      render(<ReviewDisplayView review={review} />);

      expect(screen.getByText(/3 of 3 comments selected/)).toBeInTheDocument();
      expect(screen.getByText('Select All')).toBeInTheDocument();
      expect(screen.getByText('Deselect All')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Comment Selection
  // ===========================================================================

  describe('Comment Selection', () => {
    it('should initialize non-info comments as selected', () => {
      const review = createMockReview();
      render(<ReviewDisplayView review={review} />);

      expect(screen.getByText(/3 of 3 comments selected/)).toBeInTheDocument();
    });

    it('should toggle comment selection when checkbox is clicked', async () => {
      const user = userEvent.setup();
      const review = createMockReview();
      render(<ReviewDisplayView review={review} />);

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBe(3);
      await user.click(checkboxes[0]);

      expect(screen.getByText(/2 of 3 comments selected/)).toBeInTheDocument();
    });

    it('should select all postable comments when Select All is clicked', async () => {
      const user = userEvent.setup();
      const review = createMockReview();
      render(<ReviewDisplayView review={review} />);

      await user.click(screen.getByText('Deselect All'));
      expect(screen.getByText(/0 of 3 comments selected/)).toBeInTheDocument();

      await user.click(screen.getByText('Select All'));
      expect(screen.getByText(/3 of 3 comments selected/)).toBeInTheDocument();
    });

    it('should deselect all comments when Deselect All is clicked', async () => {
      const user = userEvent.setup();
      const review = createMockReview();
      render(<ReviewDisplayView review={review} />);

      await user.click(screen.getByText('Deselect All'));

      expect(screen.getByText(/0 of 3 comments selected/)).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Post Review Flow
  // ===========================================================================

  describe('Post Review Flow', () => {
    it('should show post dialog when clicking Post Review button', async () => {
      const user = userEvent.setup();
      const review = createMockReview();
      render(<ReviewDisplayView review={review} />);

      await user.click(screen.getByRole('button', { name: /Post Review/i }));

      expect(screen.getByText('Post Review to GitLab?')).toBeInTheDocument();
      expect(screen.getByText(/3 selected comment/)).toBeInTheDocument();
    });

    it('should post selected comments calling postLineComment for line comments and postComment for general', async () => {
      const user = userEvent.setup();
      const lineComment = createMockComment({
        id: 'line-1',
        filePath: 'src/example.ts',
        lineNumber: 10,
        severity: 'warning',
        comment: 'Line comment',
      });
      const generalComment = createMockComment({
        id: 'general-1',
        filePath: 'src/example.ts',
        lineNumber: null,
        severity: 'warning',
        comment: 'General comment',
      });
      const review = createMockReview({ comments: [lineComment, generalComment] });
      render(<ReviewDisplayView review={review} />);

      await user.click(screen.getByRole('button', { name: /Post Review/i }));
      await user.click(screen.getByRole('button', { name: 'Post Comments' }));

      await waitFor(() => {
        expect(window.electronAPI.gitlab.postLineComment).toHaveBeenCalledWith(
          'namespace/project', 123, 'src/example.ts', 10, 'Line comment', expect.anything(),
        );
        expect(window.electronAPI.gitlab.postComment).toHaveBeenCalledWith(
          'namespace/project', 123, expect.stringContaining('General comment'),
        );
      });
    });

    it('should skip info and unselected comments when posting', async () => {
      const user = userEvent.setup();
      const review = createMockReview();
      render(<ReviewDisplayView review={review} />);

      await user.click(screen.getByText('Deselect All'));
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]);

      await user.click(screen.getByRole('button', { name: /Post Review/i }));
      await user.click(screen.getByRole('button', { name: 'Post Comments' }));

      await waitFor(() => {
        expect(window.electronAPI.gitlab.postLineComment).toHaveBeenCalledTimes(1);
      });
    });

    it('should show result toast after posting', async () => {
      const user = userEvent.setup();
      const review = createMockReview({
        comments: [createMockComment({ id: 'c1', severity: 'warning', lineNumber: 5 })],
      });
      render(<ReviewDisplayView review={review} />);

      await user.click(screen.getByRole('button', { name: /Post Review/i }));
      await user.click(screen.getByRole('button', { name: 'Post Comments' }));

      await waitFor(() => {
        expect(screen.getByText(/1 comments posted/)).toBeInTheDocument();
      });
    });
  });

  // ===========================================================================
  // Delete Comments
  // ===========================================================================

  describe('Delete Comments', () => {
    it('should show delete dialog when clicking Clear My Comments', async () => {
      const user = userEvent.setup();
      const review = createMockReview();
      render(<ReviewDisplayView review={review} />);

      await user.click(screen.getByRole('button', { name: /Clear My Comments/i }));

      expect(screen.getByText('Clear My Comments?')).toBeInTheDocument();
      expect(
        screen.getByText(/This will delete ALL your comments and discussion threads/),
      ).toBeInTheDocument();
    });

    it('should call deleteMyComments and show result', async () => {
      const user = userEvent.setup();
      const review = createMockReview();
      render(<ReviewDisplayView review={review} />);

      await user.click(screen.getByRole('button', { name: /Clear My Comments/i }));
      await user.click(screen.getByRole('button', { name: 'Delete Comments' }));

      await waitFor(() => {
        expect(window.electronAPI.gitlab.deleteMyComments).toHaveBeenCalledWith('namespace/project', 123);
        expect(screen.getByText(/3 comment\(s\) deleted successfully/)).toBeInTheDocument();
      });
    });
  });

  // ===========================================================================
  // Approve MR
  // ===========================================================================

  describe('Approve MR', () => {
    it('should show approve dialog when ApprovabilityBadge triggers onApprove', async () => {
      const user = userEvent.setup();
      const review = mockApprovableReview;
      render(<ReviewDisplayView review={review} />);

      const approveButton = screen.getByRole('button', { name: /Approve MR/i });
      await user.click(approveButton);

      expect(screen.getByText(/Approve MR !123\?/)).toBeInTheDocument();
      expect(screen.getByText('You are about to approve this merge request.')).toBeInTheDocument();
    });

    it('should call approveMR and show success message', async () => {
      const user = userEvent.setup();
      const review = mockApprovableReview;
      render(<ReviewDisplayView review={review} />);

      const approveButton = screen.getByRole('button', { name: /Approve MR/i });
      await user.click(approveButton);

      const overlay = screen.getByText('You are about to approve this merge request.').closest('.fixed')!;
      const confirmButtons = within(overlay as HTMLElement).getAllByRole('button', { name: /Approve MR/i });
      await user.click(confirmButtons[confirmButtons.length - 1]);

      await waitFor(() => {
        expect(window.electronAPI.gitlab.approveMR).toHaveBeenCalledWith('namespace/project', 123);
      });

      await waitFor(() => {
        expect(screen.getByText(/MR !123 aprovado com sucesso/)).toBeInTheDocument();
      });
    });
  });

  // ===========================================================================
  // Export JSON
  // ===========================================================================

  describe('Export JSON', () => {
    it('should build export data and trigger download when Export JSON is clicked', async () => {
      const user = userEvent.setup();
      const review = createMockReview();

      render(<ReviewDisplayView review={review} />);

      const { mockLink, readCapturedJSON, restore } = setupDownloadMocks();

      await user.click(screen.getByRole('button', { name: /Export JSON/i }));

      expect(mockLink.click).toHaveBeenCalled();
      expect(mockLink.download).toMatch(/^review-MR123-\d{4}-\d{2}-\d{2}\.json$/);

      const exportData = await readCapturedJSON();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mr = exportData.mr as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const summary = exportData.summary as any;
      expect(mr.number).toBe(123);
      expect(mr.project).toBe('namespace/project');
      expect(mr.author).toBe('johndoe');
      expect(mr.title).toBe('Add new feature');
      expect(summary.critical).toBe(1);
      expect(summary.warning).toBe(1);
      expect(summary.suggestion).toBe(1);
      expect(summary.approvable).toBe(false);
      expect(exportData.issues).toHaveLength(4);

      restore();
    });

    it('should show error when MR info is missing for export', async () => {
      const user = userEvent.setup();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setupStore({ currentMR: null as any });
      const review = createMockReview();
      render(<ReviewDisplayView review={review} />);

      await user.click(screen.getByRole('button', { name: /Export JSON/i }));

      expect(screen.getByText('MR information not available for export')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Refinement Flow
  // ===========================================================================

  describe('Refinement Flow', () => {
    it('should set refinement state when refine is triggered on a comment', async () => {
      const user = userEvent.setup();
      const review = createMockReview({
        comments: [createMockComment({ id: 'refine-target', severity: 'warning', comment: 'Original' })],
      });
      render(<ReviewDisplayView review={review} />);

      await user.click(screen.getByRole('button', { name: /refine/i }));

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should call refineComment and update review when refinement is submitted', async () => {
      const user = userEvent.setup();
      const onReviewUpdate = vi.fn();
      const review = createMockReview({
        comments: [createMockComment({ id: 'refine-1', severity: 'warning', comment: 'Original' })],
      });

      render(<ReviewDisplayView review={review} onReviewUpdate={onReviewUpdate} />);

      await user.click(screen.getByRole('button', { name: /refine/i }));

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Make it shorter');

      const submitButton = screen.getByRole('button', { name: /refine/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(window.electronAPI.review.refineComment).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'refine-1', comment: 'Original' }),
          'Make it shorter',
        );
      });

      await waitFor(() => {
        expect(onReviewUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            comments: [expect.objectContaining({ id: 'refine-1', comment: 'Refined comment' })],
          }),
        );
      });
    });

    it('should reset refinement state when cancel is clicked', async () => {
      const user = userEvent.setup();
      const review = createMockReview({
        comments: [createMockComment({ id: 'refine-cancel', severity: 'warning' })],
      });
      render(<ReviewDisplayView review={review} />);

      await user.click(screen.getByRole('button', { name: /refine/i }));
      expect(screen.getByRole('textbox')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Helper Functions (tested through component behavior)
  // ===========================================================================

  describe('formatCommentForGitLab (via post behavior)', () => {
    it('should post comment without code snippet block when none exists', async () => {
      const user = userEvent.setup();
      const comment = createMockComment({
        id: 'no-snippet', severity: 'warning', comment: 'Simple comment',
        codeSnippet: undefined, lineNumber: 10, filePath: 'src/example.ts',
      });
      const review = createMockReview({ comments: [comment] });
      render(<ReviewDisplayView review={review} />);

      await user.click(screen.getByRole('button', { name: /Post Review/i }));
      await user.click(screen.getByRole('button', { name: 'Post Comments' }));

      await waitFor(() => {
        expect(window.electronAPI.gitlab.postLineComment).toHaveBeenCalledWith(
          expect.any(String), expect.any(Number), expect.any(String), expect.any(Number),
          'Simple comment', expect.anything(),
        );
      });
    });

    it('should append code snippet block when present', async () => {
      const user = userEvent.setup();
      const comment = createMockComment({
        id: 'with-snippet', severity: 'warning', comment: 'Has snippet',
        codeSnippet: 'const x = 1;', lineNumber: 10, filePath: 'src/example.ts',
      });
      const review = createMockReview({ comments: [comment] });
      render(<ReviewDisplayView review={review} />);

      await user.click(screen.getByRole('button', { name: /Post Review/i }));
      await user.click(screen.getByRole('button', { name: 'Post Comments' }));

      await waitFor(() => {
        expect(window.electronAPI.gitlab.postLineComment).toHaveBeenCalledWith(
          expect.any(String), expect.any(Number), expect.any(String), expect.any(Number),
          'Has snippet\n\n```\nconst x = 1;\n```', expect.anything(),
        );
      });
    });
  });

  describe('buildGitLabLineUrl (via CommentCard lineUrl prop)', () => {
    it('should build correct URL stripping /api/v4 from base URL', () => {
      setupStore({ gitlabBaseURL: 'https://gitlab.example.com/api/v4' });
      const comment = createMockComment({
        id: 'url-test', severity: 'warning', lineNumber: 42, filePath: 'src/main.ts',
      });
      const review = createMockReview({ comments: [comment] });
      render(<ReviewDisplayView review={review} />);

      expect(screen.getByRole('button', { name: /Line 42/i })).toBeInTheDocument();
    });

    it('should encode branch name with special characters', () => {
      setupStore({ currentMR: { ...mockOpenMR, source_branch: 'feature/special chars & more' } });
      const comment = createMockComment({
        id: 'branch-encode', severity: 'warning', lineNumber: 5, filePath: 'src/test.ts',
      });
      const review = createMockReview({ comments: [comment] });
      render(<ReviewDisplayView review={review} />);

      expect(screen.getByRole('button', { name: /Line 5/i })).toBeInTheDocument();
    });
  });

  describe('buildExportData (via export behavior)', () => {
    it('should include MR metadata in export data', async () => {
      const user = userEvent.setup();
      const review = createMockReview();
      render(<ReviewDisplayView review={review} />);

      const { readCapturedJSON, restore } = setupDownloadMocks();
      await user.click(screen.getByRole('button', { name: /Export JSON/i }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await readCapturedJSON() as any;
      expect(data.mr).toEqual({
        number: 123, project: 'namespace/project',
        url: 'https://gitlab.com/namespace/project/-/merge_requests/123',
        author: 'johndoe', title: 'Add new feature',
      });

      restore();
    });

    it('should set approvable=true when no critical/warning comments', async () => {
      const user = userEvent.setup();
      const review = mockApprovableReview;
      render(<ReviewDisplayView review={review} />);

      const { readCapturedJSON, restore } = setupDownloadMocks();
      await user.click(screen.getByRole('button', { name: /Export JSON/i }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await readCapturedJSON() as any;
      expect(data.summary.approvable).toBe(true);
      expect(data.summary.critical).toBe(0);
      expect(data.summary.warning).toBe(0);

      restore();
    });

    it('should set approvable=false when critical comment exists', async () => {
      const user = userEvent.setup();
      const review = createMockReview({ comments: [mockCriticalComment, mockInfoComment] });
      render(<ReviewDisplayView review={review} />);

      const { readCapturedJSON, restore } = setupDownloadMocks();
      await user.click(screen.getByRole('button', { name: /Export JSON/i }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await readCapturedJSON() as any;
      expect(data.summary.approvable).toBe(false);
      expect(data.summary.critical).toBe(1);

      restore();
    });

    it('should include all comments as issues in export', async () => {
      const user = userEvent.setup();
      const review = createMockReview();
      render(<ReviewDisplayView review={review} />);

      const { readCapturedJSON, restore } = setupDownloadMocks();
      await user.click(screen.getByRole('button', { name: /Export JSON/i }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await readCapturedJSON() as any;
      expect(data.issues).toHaveLength(4);
      expect(data.issues[0].severity).toBe('critical');
      expect(data.issues[1].severity).toBe('warning');
      expect(data.issues[2].severity).toBe('suggestion');
      expect(data.issues[3].severity).toBe('info');

      restore();
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('Edge Cases', () => {
    it('should disable Post Review button when no comments are selected', async () => {
      const user = userEvent.setup();
      const review = createMockReview();
      render(<ReviewDisplayView review={review} />);

      await user.click(screen.getByText('Deselect All'));

      expect(screen.getByRole('button', { name: /Post Review/i })).toBeDisabled();
    });

    it('should not render selection controls when there are no postable comments', () => {
      const review = createMockReview({ comments: [mockInfoComment] });
      render(<ReviewDisplayView review={review} />);

      expect(screen.queryByText('Select All')).not.toBeInTheDocument();
      expect(screen.queryByText('Deselect All')).not.toBeInTheDocument();
    });

    it('should show error when posting without MR info', async () => {
      const user = userEvent.setup();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setupStore({ parsedUrl: null as any });
      const review = createMockReview();
      render(<ReviewDisplayView review={review} />);

      await user.click(screen.getByRole('button', { name: /Post Review/i }));
      await user.click(screen.getByRole('button', { name: 'Post Comments' }));

      await waitFor(() => {
        expect(screen.getByText('MR information not available')).toBeInTheDocument();
      });
    });

    it('should handle refinement failure gracefully', async () => {
      const user = userEvent.setup();
      window.electronAPI.review.refineComment = vi.fn().mockRejectedValue(new Error('AI unavailable'));

      const review = createMockReview({
        comments: [createMockComment({ id: 'fail-refine', severity: 'warning' })],
      });
      render(<ReviewDisplayView review={review} />);

      await user.click(screen.getByRole('button', { name: /refine/i }));
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Improve');

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const submitButton = screen.getByRole('button', { name: /refine/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('AI unavailable')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });
});
