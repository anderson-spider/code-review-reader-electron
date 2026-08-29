import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommentRefinementInput } from '../CommentRefinementInput';

describe('CommentRefinementInput', () => {
  const defaultProps = {
    onRefine: vi.fn(),
    onCancel: vi.fn(),
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render textarea for refinement instructions', () => {
      render(<CommentRefinementInput {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveAttribute('placeholder', expect.stringContaining('refinement'));
    });

    it('should render Refine button', () => {
      render(<CommentRefinementInput {...defaultProps} />);

      const refineButton = screen.getByRole('button', { name: /refine/i });
      expect(refineButton).toBeInTheDocument();
    });

    it('should render Cancel button', () => {
      render(<CommentRefinementInput {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toBeInTheDocument();
    });
  });

  describe('Textarea Interaction', () => {
    it('should allow user to type refinement instructions', async () => {
      const user = userEvent.setup();
      render(<CommentRefinementInput {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Make it more concise');

      expect(textarea).toHaveValue('Make it more concise');
    });

    it('should focus textarea on mount', () => {
      render(<CommentRefinementInput {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveFocus();
    });
  });

  describe('Refine Button', () => {
    it('should call onRefine with instructions when clicked', async () => {
      const user = userEvent.setup();
      const onRefineMock = vi.fn();
      render(<CommentRefinementInput {...defaultProps} onRefine={onRefineMock} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Make it shorter');

      const refineButton = screen.getByRole('button', { name: /refine/i });
      await user.click(refineButton);

      expect(onRefineMock).toHaveBeenCalledWith('Make it shorter');
      expect(onRefineMock).toHaveBeenCalledTimes(1);
    });

    it('should be disabled when textarea is empty', () => {
      render(<CommentRefinementInput {...defaultProps} />);

      const refineButton = screen.getByRole('button', { name: /refine/i });
      expect(refineButton).toBeDisabled();
    });

    it('should be enabled when textarea has content', async () => {
      const user = userEvent.setup();
      render(<CommentRefinementInput {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Some instructions');

      const refineButton = screen.getByRole('button', { name: /refine/i });
      expect(refineButton).not.toBeDisabled();
    });

    it('should be disabled when isLoading is true', async () => {
      const user = userEvent.setup();
      render(<CommentRefinementInput {...defaultProps} isLoading={true} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Some instructions');

      const refineButton = screen.getByRole('button', { name: /refin/i });
      expect(refineButton).toBeDisabled();
    });
  });

  describe('Cancel Button', () => {
    it('should call onCancel when clicked', async () => {
      const user = userEvent.setup();
      const onCancelMock = vi.fn();
      render(<CommentRefinementInput {...defaultProps} onCancel={onCancelMock} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(onCancelMock).toHaveBeenCalledTimes(1);
    });

    it('should be disabled when isLoading is true', () => {
      render(<CommentRefinementInput {...defaultProps} isLoading={true} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toBeDisabled();
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner on Refine button when isLoading is true', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<CommentRefinementInput {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Instructions');

      rerender(<CommentRefinementInput {...defaultProps} isLoading={true} />);

      // Check for loading indicator (spinner or "Refining..." text)
      expect(screen.getByText(/refining/i)).toBeInTheDocument();
    });

    it('should disable textarea when isLoading is true', () => {
      render(<CommentRefinementInput {...defaultProps} isLoading={true} />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeDisabled();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should submit on Cmd+Enter (Mac) or Ctrl+Enter (Windows)', async () => {
      const user = userEvent.setup();
      const onRefineMock = vi.fn();
      render(<CommentRefinementInput {...defaultProps} onRefine={onRefineMock} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Instructions');
      await user.keyboard('{Control>}{Enter}{/Control}');

      expect(onRefineMock).toHaveBeenCalledWith('Instructions');
    });

    it('should cancel on Escape key', async () => {
      const user = userEvent.setup();
      const onCancelMock = vi.fn();
      render(<CommentRefinementInput {...defaultProps} onCancel={onCancelMock} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Instructions');
      await user.keyboard('{Escape}');

      expect(onCancelMock).toHaveBeenCalledTimes(1);
    });

    it('should not submit on Enter without modifier', async () => {
      const user = userEvent.setup();
      const onRefineMock = vi.fn();
      render(<CommentRefinementInput {...defaultProps} onRefine={onRefineMock} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Instructions');
      await user.keyboard('{Enter}');

      // Should not submit - Enter is for new line in textarea
      expect(onRefineMock).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-label on textarea', () => {
      render(<CommentRefinementInput {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('aria-label', 'Refinement instructions');
    });

    it('should associate loading state with button', () => {
      render(<CommentRefinementInput {...defaultProps} isLoading={true} />);

      const refineButton = screen.getByRole('button', { name: /refin/i });
      expect(refineButton).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('Styling', () => {
    it('should have proper dark mode classes', () => {
      const { container } = render(<CommentRefinementInput {...defaultProps} />);

      const textarea = container.querySelector('textarea');
      expect(textarea).toHaveClass('dark:bg-gray-700');
    });

    it('should have proper border styling', () => {
      const { container } = render(<CommentRefinementInput {...defaultProps} />);

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('border');
    });
  });
});
