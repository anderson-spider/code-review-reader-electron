import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommentCard } from '../CommentCard';
import type { ReviewComment } from '../../../shared/types';

describe('CommentCard', () => {
  const baseComment: ReviewComment = {
    id: '1',
    filePath: 'src/example.ts',
    lineNumber: 42,
    severity: 'info',
    comment: 'This is a test comment',
    codeSnippet: undefined,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Severity Display', () => {
    it('should display info severity with correct icon and styling', () => {
      render(<CommentCard comment={{ ...baseComment, severity: 'info' }} />);

      const severityIcon = screen.getByRole('img', { name: 'info' });
      expect(severityIcon).toHaveTextContent('📝');

      const severityLabel = screen.getByText('INFO');
      expect(severityLabel).toBeInTheDocument();
    });

    it('should display suggestion severity with correct icon and styling', () => {
      render(<CommentCard comment={{ ...baseComment, severity: 'suggestion' }} />);

      const severityIcon = screen.getByRole('img', { name: 'suggestion' });
      expect(severityIcon).toHaveTextContent('💡');

      const severityLabel = screen.getByText('SUGGESTION');
      expect(severityLabel).toBeInTheDocument();
    });

    it('should display warning severity with correct icon and styling', () => {
      render(<CommentCard comment={{ ...baseComment, severity: 'warning' }} />);

      const severityIcon = screen.getByRole('img', { name: 'warning' });
      expect(severityIcon).toHaveTextContent('⚠️');

      const severityLabel = screen.getByText('WARNING');
      expect(severityLabel).toBeInTheDocument();
    });

    it('should display critical severity with correct icon and styling', () => {
      render(<CommentCard comment={{ ...baseComment, severity: 'critical' }} />);

      const severityIcon = screen.getByRole('img', { name: 'critical' });
      expect(severityIcon).toHaveTextContent('🚨');

      const severityLabel = screen.getByText('CRITICAL');
      expect(severityLabel).toBeInTheDocument();
    });
  });

  describe('Line Number Display', () => {
    it('should display line number when provided', () => {
      render(<CommentCard comment={baseComment} />);

      expect(screen.getByText('Line 42')).toBeInTheDocument();
    });

    it('should not display line number when null', () => {
      const commentWithoutLine = { ...baseComment, lineNumber: null };
      render(<CommentCard comment={commentWithoutLine} />);

      expect(screen.queryByText(/Line/)).not.toBeInTheDocument();
    });

    it('should render line number as clickable link when lineUrl is provided', () => {
      const lineUrl = 'https://gitlab.com/project/merge_requests/1#L42';
      render(<CommentCard comment={baseComment} lineUrl={lineUrl} />);

      const lineButton = screen.getByRole('button', { name: /Line 42/i });
      expect(lineButton).toBeInTheDocument();
      expect(lineButton).toHaveClass('text-blue-600');
    });

    it('should render line number as plain text when lineUrl is not provided', () => {
      render(<CommentCard comment={baseComment} />);

      expect(screen.queryByRole('button', { name: /Line 42/i })).not.toBeInTheDocument();
      expect(screen.getByText('Line 42')).toBeInTheDocument();
    });
  });

  describe('Line Click Handler', () => {
    it('should call window.electronAPI.app.openExternal when line number is clicked', async () => {
      const user = userEvent.setup();
      const lineUrl = 'https://gitlab.com/project/merge_requests/1#L42';
      const openExternalMock = vi.fn().mockResolvedValue(undefined);
      window.electronAPI.app.openExternal = openExternalMock;

      render(<CommentCard comment={baseComment} lineUrl={lineUrl} />);

      const lineButton = screen.getByRole('button', { name: /Line 42/i });
      await user.click(lineButton);

      expect(openExternalMock).toHaveBeenCalledWith(lineUrl);
      expect(openExternalMock).toHaveBeenCalledTimes(1);
    });

    it('should not call openExternal when lineUrl is not provided', () => {
      const openExternalMock = vi.fn().mockResolvedValue(undefined);
      window.electronAPI.app.openExternal = openExternalMock;

      render(<CommentCard comment={baseComment} />);

      // Line number should be text, not a button
      expect(screen.getByText('Line 42')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Line 42/i })).not.toBeInTheDocument();
      expect(openExternalMock).not.toHaveBeenCalled();
    });

    it('should handle errors when openExternal fails', async () => {
      const user = userEvent.setup();
      const lineUrl = 'https://gitlab.com/project/merge_requests/1#L42';
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const openExternalMock = vi.fn().mockRejectedValue(new Error('Failed to open'));
      window.electronAPI.app.openExternal = openExternalMock;

      render(<CommentCard comment={baseComment} lineUrl={lineUrl} />);

      const lineButton = screen.getByRole('button', { name: /Line 42/i });
      await user.click(lineButton);

      expect(openExternalMock).toHaveBeenCalledWith(lineUrl);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to open external link:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Comment Content', () => {
    it('should display the comment text', () => {
      render(<CommentCard comment={baseComment} />);

      expect(screen.getByText('This is a test comment')).toBeInTheDocument();
    });

    it('should display long comment text with proper word breaking', () => {
      const longComment = {
        ...baseComment,
        comment: 'This is a very long comment that should wrap properly and break words when necessary',
      };
      render(<CommentCard comment={longComment} />);

      const commentText = screen.getByText(longComment.comment);
      expect(commentText).toBeInTheDocument();
      expect(commentText).toHaveClass('break-words');
    });
  });

  describe('Checkbox and Selection', () => {
    it('should display checkbox when onToggle is provided', () => {
      const onToggleMock = vi.fn();
      render(<CommentCard comment={baseComment} onToggle={onToggleMock} />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).toBeChecked();
    });

    it('should not display checkbox when onToggle is not provided', () => {
      render(<CommentCard comment={baseComment} />);

      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('should call onToggle when checkbox is clicked', async () => {
      const user = userEvent.setup();
      const onToggleMock = vi.fn();
      render(<CommentCard comment={baseComment} onToggle={onToggleMock} selected={true} />);

      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);

      expect(onToggleMock).toHaveBeenCalledWith('1');
      expect(onToggleMock).toHaveBeenCalledTimes(1);
    });

    it('should call onToggle when card is clicked', async () => {
      const user = userEvent.setup();
      const onToggleMock = vi.fn();
      render(<CommentCard comment={baseComment} onToggle={onToggleMock} selected={true} />);

      const card = screen.getByText('This is a test comment').closest('div')?.parentElement;
      if (card) {
        await user.click(card);
        expect(onToggleMock).toHaveBeenCalledWith('1');
      }
    });

    it('should show checkbox as checked when selected is true', () => {
      const onToggleMock = vi.fn();
      render(<CommentCard comment={baseComment} onToggle={onToggleMock} selected={true} />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });

    it('should show checkbox as unchecked when selected is false', () => {
      const onToggleMock = vi.fn();
      render(<CommentCard comment={baseComment} onToggle={onToggleMock} selected={false} />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeChecked();
    });

    it('should apply opacity style when selected is false', () => {
      const onToggleMock = vi.fn();
      const { container } = render(
        <CommentCard comment={baseComment} onToggle={onToggleMock} selected={false} />
      );

      const card = container.querySelector('.opacity-50');
      expect(card).toBeInTheDocument();
    });

    it('should not apply opacity style when selected is true', () => {
      const onToggleMock = vi.fn();
      const { container } = render(
        <CommentCard comment={baseComment} onToggle={onToggleMock} selected={true} />
      );

      const card = container.querySelector('.opacity-50');
      expect(card).not.toBeInTheDocument();
    });

    it('should default to checked when selected is not provided but onToggle is', () => {
      const onToggleMock = vi.fn();
      render(<CommentCard comment={baseComment} onToggle={onToggleMock} />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });
  });

  describe('Code Snippet Display', () => {
    it('should display code snippet when provided', () => {
      const commentWithSnippet = {
        ...baseComment,
        codeSnippet: 'const x = data.value; // <-- issue: may be null\n// fix: const x = data?.value ?? defaultValue;',
      };
      render(<CommentCard comment={commentWithSnippet} />);

      expect(screen.getByText(/const x = data\.value/)).toBeInTheDocument();
    });

    it('should not display code snippet section when codeSnippet is null', () => {
      render(<CommentCard comment={baseComment} />);

      // Check that no code element exists (codeSnippet uses <code> tag)
      const codeElements = document.querySelectorAll('code');
      expect(codeElements.length).toBe(0);
    });

    it('should display multi-line code snippet with proper formatting', () => {
      const commentWithMultiLineSnippet = {
        ...baseComment,
        codeSnippet: 'try {\n  doSomething(); // <-- issue\n} finally {\n  cleanup();\n}',
      };
      render(<CommentCard comment={commentWithMultiLineSnippet} />);

      const codeElement = screen.getByText(/try \{/);
      expect(codeElement).toHaveClass('whitespace-pre');
    });

    it('should have proper styling for code snippet block', () => {
      const commentWithSnippet = {
        ...baseComment,
        codeSnippet: 'const value = x; // <-- issue here',
      };
      const { container } = render(<CommentCard comment={commentWithSnippet} />);

      const codeBlock = container.querySelector('.bg-gray-800');
      expect(codeBlock).toBeInTheDocument();

      const code = container.querySelector('code');
      expect(code).toHaveClass('font-mono', 'text-green-400');
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-label on severity icon', () => {
      render(<CommentCard comment={baseComment} />);

      const icon = screen.getByRole('img', { name: 'info' });
      expect(icon).toBeInTheDocument();
    });

    it('should have title attribute on line number button', () => {
      const lineUrl = 'https://gitlab.com/project/merge_requests/1#L42';
      render(<CommentCard comment={baseComment} lineUrl={lineUrl} />);

      const lineButton = screen.getByRole('button', { name: /Line 42/i });
      expect(lineButton).toHaveAttribute('title', 'Open in GitLab');
    });
  });

  describe('Severity Editing', () => {
    it('should render dropdown when onSeverityChange is provided', () => {
      const onChangeMock = vi.fn();
      render(<CommentCard comment={baseComment} onSeverityChange={onChangeMock} />);
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should call onSeverityChange with correct arguments when severity is changed', async () => {
      const user = userEvent.setup();
      const onChangeMock = vi.fn();
      render(<CommentCard comment={baseComment} onSeverityChange={onChangeMock} />);

      await user.selectOptions(screen.getByRole('combobox'), 'critical');
      expect(onChangeMock).toHaveBeenCalledWith('1', 'critical');
    });

    it('should render static badge when onSeverityChange is not provided', () => {
      render(<CommentCard comment={baseComment} />);
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
      expect(screen.getByText('INFO')).toBeInTheDocument();
    });

    it('should display all severity options in dropdown', () => {
      const onChangeMock = vi.fn();
      render(<CommentCard comment={baseComment} onSeverityChange={onChangeMock} />);

      const dropdown = screen.getByRole('combobox');
      expect(dropdown).toHaveDisplayValue('INFO');

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(4);
      expect(options.map((o) => o.textContent)).toEqual(['CRITICAL', 'WARNING', 'SUGGESTION', 'INFO']);
    });

    it('should not trigger card toggle when severity dropdown is changed', async () => {
      const user = userEvent.setup();
      const onToggleMock = vi.fn();
      const onChangeMock = vi.fn();
      render(
        <CommentCard
          comment={baseComment}
          onToggle={onToggleMock}
          selected={true}
          onSeverityChange={onChangeMock}
        />
      );

      await user.selectOptions(screen.getByRole('combobox'), 'warning');

      // onToggle should not be called when changing severity
      expect(onToggleMock).not.toHaveBeenCalled();
      expect(onChangeMock).toHaveBeenCalledWith('1', 'warning');
    });
  });

  describe('Refinement Feature', () => {
    it('should render refine button when onRefine prop is provided', () => {
      const onRefineMock = vi.fn();
      render(<CommentCard comment={baseComment} onRefine={onRefineMock} />);

      const refineButton = screen.getByRole('button', { name: /refine/i });
      expect(refineButton).toBeInTheDocument();
    });

    it('should not render refine button when onRefine prop is not provided', () => {
      render(<CommentCard comment={baseComment} />);

      expect(screen.queryByRole('button', { name: /refine/i })).not.toBeInTheDocument();
    });

    it('should call onRefine with comment id when refine button is clicked', async () => {
      const user = userEvent.setup();
      const onRefineMock = vi.fn();
      render(<CommentCard comment={baseComment} onRefine={onRefineMock} />);

      const refineButton = screen.getByRole('button', { name: /refine/i });
      await user.click(refineButton);

      expect(onRefineMock).toHaveBeenCalledWith('1');
      expect(onRefineMock).toHaveBeenCalledTimes(1);
    });

    it('should render CommentRefinementInput when isRefining is true', () => {
      const onRefineMock = vi.fn();
      const onRefineCancelMock = vi.fn();
      const onRefineSubmitMock = vi.fn();
      render(
        <CommentCard
          comment={baseComment}
          onRefine={onRefineMock}
          isRefining={true}
          isRefineLoading={false}
          onRefineCancel={onRefineCancelMock}
          onRefineSubmit={onRefineSubmitMock}
        />
      );

      // Check for refinement input textarea
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
    });

    it('should not render CommentRefinementInput when isRefining is false', () => {
      const onRefineMock = vi.fn();
      render(
        <CommentCard
          comment={baseComment}
          onRefine={onRefineMock}
          isRefining={false}
        />
      );

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('should hide refine button when isRefining is true', () => {
      const onRefineMock = vi.fn();
      const onRefineCancelMock = vi.fn();
      const onRefineSubmitMock = vi.fn();
      render(
        <CommentCard
          comment={baseComment}
          onRefine={onRefineMock}
          isRefining={true}
          isRefineLoading={false}
          onRefineCancel={onRefineCancelMock}
          onRefineSubmit={onRefineSubmitMock}
        />
      );

      // The refine button should not be visible when refinement input is shown
      const refineButtons = screen.queryAllByRole('button', { name: /^refine$/i });
      // Only the submit button in the input should have "Refine" text
      expect(refineButtons.length).toBeLessThanOrEqual(1);
    });

    it('should call onRefineSubmit when refinement is submitted', async () => {
      const user = userEvent.setup();
      const onRefineMock = vi.fn();
      const onRefineCancelMock = vi.fn();
      const onRefineSubmitMock = vi.fn();
      render(
        <CommentCard
          comment={baseComment}
          onRefine={onRefineMock}
          isRefining={true}
          isRefineLoading={false}
          onRefineCancel={onRefineCancelMock}
          onRefineSubmit={onRefineSubmitMock}
        />
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Make it shorter');

      const submitButton = screen.getByRole('button', { name: /refine/i });
      await user.click(submitButton);

      expect(onRefineSubmitMock).toHaveBeenCalledWith('Make it shorter');
    });

    it('should call onRefineCancel when cancel is clicked', async () => {
      const user = userEvent.setup();
      const onRefineMock = vi.fn();
      const onRefineCancelMock = vi.fn();
      const onRefineSubmitMock = vi.fn();
      render(
        <CommentCard
          comment={baseComment}
          onRefine={onRefineMock}
          isRefining={true}
          isRefineLoading={false}
          onRefineCancel={onRefineCancelMock}
          onRefineSubmit={onRefineSubmitMock}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(onRefineCancelMock).toHaveBeenCalledTimes(1);
    });

    it('should pass isRefineLoading to CommentRefinementInput', () => {
      const onRefineMock = vi.fn();
      const onRefineCancelMock = vi.fn();
      const onRefineSubmitMock = vi.fn();
      render(
        <CommentCard
          comment={baseComment}
          onRefine={onRefineMock}
          isRefining={true}
          isRefineLoading={true}
          onRefineCancel={onRefineCancelMock}
          onRefineSubmit={onRefineSubmitMock}
        />
      );

      // When loading, buttons should be disabled and show loading state
      expect(screen.getByText(/refining/i)).toBeInTheDocument();
    });

    it('should not trigger card toggle when refine button is clicked', async () => {
      const user = userEvent.setup();
      const onToggleMock = vi.fn();
      const onRefineMock = vi.fn();
      render(
        <CommentCard
          comment={baseComment}
          onToggle={onToggleMock}
          selected={true}
          onRefine={onRefineMock}
        />
      );

      const refineButton = screen.getByRole('button', { name: /refine/i });
      await user.click(refineButton);

      // onToggle should not be called when clicking refine button
      expect(onToggleMock).not.toHaveBeenCalled();
      expect(onRefineMock).toHaveBeenCalledWith('1');
    });
  });
});
