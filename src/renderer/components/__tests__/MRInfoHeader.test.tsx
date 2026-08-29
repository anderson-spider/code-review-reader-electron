import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MRInfoHeader } from '../MRInfoHeader';
import type { MergeRequest, FileChange } from '../../../shared/types';

describe('MRInfoHeader', () => {
  const baseMR: MergeRequest = {
    id: 1,
    iid: 123,
    title: 'Test MR Title',
    description: 'Test description',
    source_branch: 'feature-branch',
    target_branch: 'main',
    author: {
      id: 1,
      name: 'John Doe',
      username: 'johndoe',
    },
    web_url: 'https://gitlab.com/project/merge_requests/123',
    sha: 'abc123',
    state: 'opened',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    changes_count: 3,
  };

  const sampleChanges: FileChange[] = [
    {
      old_path: 'src/file1.ts',
      new_path: 'src/file1.ts',
      diff: `@@ -1,3 +1,5 @@
+added line 1
+added line 2
 existing line
-removed line`,
      new_file: false,
      renamed_file: false,
      deleted_file: false,
    },
    {
      old_path: 'src/file2.ts',
      new_path: 'src/file2.ts',
      diff: `@@ -10,2 +10,3 @@
+another added line
 existing line`,
      new_file: false,
      renamed_file: false,
      deleted_file: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('MR Info Display', () => {
    it('should display MR title with IID', () => {
      render(<MRInfoHeader mr={baseMR} />);

      expect(screen.getByText(/MR !123:/)).toBeInTheDocument();
      expect(screen.getByText(/Test MR Title/)).toBeInTheDocument();
    });

    it('should display author name', () => {
      render(<MRInfoHeader mr={baseMR} />);

      expect(screen.getByText(/Author: John Doe/)).toBeInTheDocument();
    });

    it('should display source branch', () => {
      render(<MRInfoHeader mr={baseMR} />);

      expect(screen.getByText('feature-branch')).toBeInTheDocument();
    });

    it('should display target branch', () => {
      render(<MRInfoHeader mr={baseMR} />);

      expect(screen.getByText('main')).toBeInTheDocument();
    });

    it('should display branches with arrow between them', () => {
      render(<MRInfoHeader mr={baseMR} />);

      const sourceBranch = screen.getByText('feature-branch');
      const targetBranch = screen.getByText('main');
      const arrow = screen.getByText('→');

      expect(sourceBranch).toBeInTheDocument();
      expect(arrow).toBeInTheDocument();
      expect(targetBranch).toBeInTheDocument();
    });
  });

  describe('File Count Display', () => {
    it('should display file count from changes_count when provided', () => {
      render(<MRInfoHeader mr={baseMR} />);

      expect(screen.getByText(/3 files/)).toBeInTheDocument();
    });

    it('should display file count from changes array length when changes_count not provided', () => {
      const mrWithoutChangesCount = { ...baseMR, changes_count: undefined };
      render(<MRInfoHeader mr={mrWithoutChangesCount} changes={sampleChanges} />);

      expect(screen.getByText(/2 files/)).toBeInTheDocument();
    });

    it('should display singular "file" when count is 1', () => {
      const mrWithOneFile = { ...baseMR, changes_count: 1 };
      render(<MRInfoHeader mr={mrWithOneFile} />);

      expect(screen.getByText(/1 file$/)).toBeInTheDocument();
      expect(screen.queryByText(/files/)).not.toBeInTheDocument();
    });

    it('should display plural "files" when count is greater than 1', () => {
      render(<MRInfoHeader mr={baseMR} />);

      expect(screen.getByText(/3 files/)).toBeInTheDocument();
    });

    it('should default to 0 files when no changes_count and no changes array', () => {
      const mrWithoutChanges = { ...baseMR, changes_count: undefined };
      render(<MRInfoHeader mr={mrWithoutChanges} />);

      expect(screen.getByText(/0 files/)).toBeInTheDocument();
    });
  });

  describe('Diff Stats Calculation', () => {
    it('should calculate additions correctly from diff', () => {
      render(<MRInfoHeader mr={baseMR} changes={sampleChanges} />);

      // First file has 2 additions, second file has 1 addition = 3 total
      expect(screen.getByText(/\+3/)).toBeInTheDocument();
    });

    it('should calculate deletions correctly from diff', () => {
      render(<MRInfoHeader mr={baseMR} changes={sampleChanges} />);

      // First file has 1 deletion = 1 total
      expect(screen.getByText(/-1/)).toBeInTheDocument();
    });

    it('should show 0 additions and 0 deletions when no changes provided', () => {
      render(<MRInfoHeader mr={baseMR} />);

      expect(screen.getByText(/\+0/)).toBeInTheDocument();
      expect(screen.getByText(/-0/)).toBeInTheDocument();
    });

    it('should ignore diff header lines (+++, ---)', () => {
      const changesWithHeaders: FileChange[] = [
        {
          old_path: 'src/test.ts',
          new_path: 'src/test.ts',
          diff: `--- a/src/test.ts
+++ b/src/test.ts
@@ -1,1 +1,2 @@
+new line
 existing line`,
          new_file: false,
          renamed_file: false,
          deleted_file: false,
        },
      ];

      render(<MRInfoHeader mr={baseMR} changes={changesWithHeaders} />);

      // Should only count the actual addition, not the +++ header
      expect(screen.getByText(/\+1/)).toBeInTheDocument();
      expect(screen.getByText(/-0/)).toBeInTheDocument();
    });

    it('should display "lines" label for line changes', () => {
      render(<MRInfoHeader mr={baseMR} changes={sampleChanges} />);

      expect(screen.getByText(/lines$/)).toBeInTheDocument();
    });
  });

  describe('Opening MR in Browser', () => {
    it('should call window.electronAPI.app.openExternal when title is clicked', async () => {
      const user = userEvent.setup();
      const openExternalMock = vi.fn().mockResolvedValue(undefined);
      window.electronAPI.app.openExternal = openExternalMock;

      render(<MRInfoHeader mr={baseMR} />);

      const titleButton = screen.getByRole('button', { name: /MR !123: Test MR Title/i });
      await user.click(titleButton);

      expect(openExternalMock).toHaveBeenCalledWith(baseMR.web_url);
      expect(openExternalMock).toHaveBeenCalledTimes(1);
    });

    it('should handle errors when openExternal fails', async () => {
      const user = userEvent.setup();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const openExternalMock = vi.fn().mockRejectedValue(new Error('Failed to open'));
      window.electronAPI.app.openExternal = openExternalMock;

      render(<MRInfoHeader mr={baseMR} />);

      const titleButton = screen.getByRole('button', { name: /MR !123: Test MR Title/i });
      await user.click(titleButton);

      expect(openExternalMock).toHaveBeenCalledWith(baseMR.web_url);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to open MR URL:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should have hover styles on title button', () => {
      render(<MRInfoHeader mr={baseMR} />);

      const titleButton = screen.getByRole('button', { name: /MR !123: Test MR Title/i });
      expect(titleButton).toHaveClass('hover:underline');
    });
  });

  describe('Conflict Warning', () => {
    it('should display conflict warning when has_conflicts is true', () => {
      const mrWithConflicts = { ...baseMR, has_conflicts: true };
      render(<MRInfoHeader mr={mrWithConflicts} />);

      expect(screen.getByText(/This MR has conflicts and needs to be rebased/)).toBeInTheDocument();
    });

    it('should not display conflict warning when has_conflicts is false', () => {
      const mrWithoutConflicts = { ...baseMR, has_conflicts: false };
      render(<MRInfoHeader mr={mrWithoutConflicts} />);

      expect(screen.queryByText(/conflicts/)).not.toBeInTheDocument();
    });

    it('should not display conflict warning when has_conflicts is undefined', () => {
      render(<MRInfoHeader mr={baseMR} />);

      expect(screen.queryByText(/conflicts/)).not.toBeInTheDocument();
    });

    it('should display warning icon with conflict message', () => {
      const mrWithConflicts = { ...baseMR, has_conflicts: true };
      render(<MRInfoHeader mr={mrWithConflicts} />);

      const warningText = screen.getByText(/This MR has conflicts and needs to be rebased/);
      const warningContainer = warningText.closest('div');

      expect(warningContainer).toHaveClass('bg-red-50');
      expect(screen.getByText('⚠️')).toBeInTheDocument();
    });
  });

  describe('UI Structure', () => {
    it('should display tree structure with proper decorators', () => {
      render(<MRInfoHeader mr={baseMR} />);

      // Check for tree structure decorators (multiple ├─ exist)
      const branchDecorators = screen.getAllByText('├─');
      expect(branchDecorators.length).toBeGreaterThan(0);
      expect(screen.getByText('└─')).toBeInTheDocument();
    });

    it('should have proper emoji icons', () => {
      render(<MRInfoHeader mr={baseMR} />);

      // Check for emojis in the content
      expect(screen.getByText(/📊/)).toBeInTheDocument(); // MR icon
      expect(screen.getByText(/👤/)).toBeInTheDocument(); // Author icon
      expect(screen.getByText(/🎯/)).toBeInTheDocument(); // Branches icon
      expect(screen.getByText(/📁/)).toBeInTheDocument(); // Files icon
      expect(screen.getByText(/📈/)).toBeInTheDocument(); // Stats icon
    });

    it('should have colored branch badges', () => {
      render(<MRInfoHeader mr={baseMR} />);

      const sourceBranch = screen.getByText('feature-branch');
      const targetBranch = screen.getByText('main');

      expect(sourceBranch).toHaveClass('bg-blue-100');
      expect(targetBranch).toHaveClass('bg-green-100');
    });

    it('should display additions in green', () => {
      render(<MRInfoHeader mr={baseMR} changes={sampleChanges} />);

      const additionsText = screen.getByText(/\+3/);
      expect(additionsText).toHaveClass('text-green-600');
    });

    it('should display deletions in red', () => {
      render(<MRInfoHeader mr={baseMR} changes={sampleChanges} />);

      const deletionsText = screen.getByText(/-1/);
      expect(deletionsText).toHaveClass('text-red-600');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty changes array', () => {
      // Need to remove changes_count to test fallback to changes array length
      const mrWithoutCount = { ...baseMR, changes_count: undefined };
      render(<MRInfoHeader mr={mrWithoutCount} changes={[]} />);

      expect(screen.getByText(/0 files/)).toBeInTheDocument();
      expect(screen.getByText(/\+0/)).toBeInTheDocument();
      expect(screen.getByText(/-0/)).toBeInTheDocument();
    });

    it('should handle MR with very long title', () => {
      const mrWithLongTitle = {
        ...baseMR,
        title: 'This is a very long merge request title that should wrap properly and not break the layout when displayed in the component',
      };

      render(<MRInfoHeader mr={mrWithLongTitle} />);

      // Title is rendered inside h2 with MR number prefix
      expect(screen.getByText(/This is a very long merge request title/)).toBeInTheDocument();
    });

    it('should handle MR with special characters in branch names', () => {
      const mrWithSpecialBranches = {
        ...baseMR,
        source_branch: 'feature/US-123/my-feature',
        target_branch: 'release/v1.0.0',
      };

      render(<MRInfoHeader mr={mrWithSpecialBranches} />);

      expect(screen.getByText('feature/US-123/my-feature')).toBeInTheDocument();
      expect(screen.getByText('release/v1.0.0')).toBeInTheDocument();
    });

    it('should handle large number of line changes', () => {
      const largeChanges: FileChange[] = [
        {
          old_path: 'src/large.ts',
          new_path: 'src/large.ts',
          diff: '+new line\n'.repeat(1000) + '-old line\n'.repeat(500),
          new_file: false,
          renamed_file: false,
          deleted_file: false,
        },
      ];

      render(<MRInfoHeader mr={baseMR} changes={largeChanges} />);

      expect(screen.getByText(/\+1000/)).toBeInTheDocument();
      expect(screen.getByText(/-500/)).toBeInTheDocument();
    });
  });
});
