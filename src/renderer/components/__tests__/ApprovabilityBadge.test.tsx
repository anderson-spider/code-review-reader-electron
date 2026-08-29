import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApprovabilityBadge } from '../ApprovabilityBadge';
import type { ReviewComment } from '../../../shared/types';

describe('ApprovabilityBadge', () => {
  const createComment = (severity: 'critical' | 'warning' | 'suggestion' | 'info', id: string): ReviewComment => ({
    id,
    filePath: 'src/test.ts',
    lineNumber: 1,
    severity,
    comment: `Test ${severity} comment`,
  });

  describe('Approvability Logic (RN-APV-001)', () => {
    it('shows Approvable when no critical or warning comments', () => {
      const comments = [
        createComment('suggestion', '1'),
        createComment('info', '2'),
      ];
      render(<ApprovabilityBadge comments={comments} />);
      expect(screen.getByText('Approvable')).toBeInTheDocument();
    });

    it('shows Not Approvable when critical comments exist', () => {
      const comments = [
        createComment('critical', '1'),
        createComment('suggestion', '2'),
      ];
      render(<ApprovabilityBadge comments={comments} />);
      expect(screen.getByText('Not Approvable')).toBeInTheDocument();
    });

    it('shows Not Approvable when warning comments exist', () => {
      const comments = [
        createComment('warning', '1'),
        createComment('suggestion', '2'),
      ];
      render(<ApprovabilityBadge comments={comments} />);
      expect(screen.getByText('Not Approvable')).toBeInTheDocument();
    });

    it('shows Not Approvable when both critical and warning exist', () => {
      const comments = [
        createComment('critical', '1'),
        createComment('warning', '2'),
      ];
      render(<ApprovabilityBadge comments={comments} />);
      expect(screen.getByText('Not Approvable')).toBeInTheDocument();
    });

    it('shows Approvable with empty comments array', () => {
      render(<ApprovabilityBadge comments={[]} />);
      expect(screen.getByText('Approvable')).toBeInTheDocument();
    });
  });

  describe('Severity Counts Display', () => {
    it('displays critical count', () => {
      const comments = [createComment('critical', '1'), createComment('critical', '2')];
      render(<ApprovabilityBadge comments={comments} />);
      expect(screen.getByText(/2 Critical/)).toBeInTheDocument();
    });

    it('displays warning count', () => {
      const comments = [createComment('warning', '1')];
      render(<ApprovabilityBadge comments={comments} />);
      expect(screen.getByText(/1 Warning/)).toBeInTheDocument();
    });

    it('displays suggestion count with plural', () => {
      const comments = [
        createComment('suggestion', '1'),
        createComment('suggestion', '2'),
        createComment('suggestion', '3'),
      ];
      render(<ApprovabilityBadge comments={comments} />);
      expect(screen.getByText(/3 Suggestions/)).toBeInTheDocument();
    });

    it('displays suggestion count singular', () => {
      const comments = [createComment('suggestion', '1')];
      render(<ApprovabilityBadge comments={comments} />);
      expect(screen.getByText(/1 Suggestion(?!s)/)).toBeInTheDocument();
    });

    it('displays info count', () => {
      const comments = [createComment('info', '1')];
      render(<ApprovabilityBadge comments={comments} />);
      expect(screen.getByText(/1 Info/)).toBeInTheDocument();
    });

    it('shows "No issues found" when no comments', () => {
      render(<ApprovabilityBadge comments={[]} />);
      expect(screen.getByText('No issues found')).toBeInTheDocument();
    });
  });

  describe('Blocking Reason Messages', () => {
    it('shows critical-only blocking message', () => {
      const comments = [createComment('critical', '1')];
      render(<ApprovabilityBadge comments={comments} />);
      expect(screen.getByText('Contains critical issues that must be addressed')).toBeInTheDocument();
    });

    it('shows warning-only blocking message', () => {
      const comments = [createComment('warning', '1')];
      render(<ApprovabilityBadge comments={comments} />);
      expect(screen.getByText('Contains warnings that must be addressed')).toBeInTheDocument();
    });

    it('shows combined blocking message for critical and warning', () => {
      const comments = [
        createComment('critical', '1'),
        createComment('warning', '2'),
      ];
      render(<ApprovabilityBadge comments={comments} />);
      expect(screen.getByText('Contains critical issues and warnings that must be addressed')).toBeInTheDocument();
    });
  });

  describe('Approve Button', () => {
    it('shows approve button when approvable and callback provided', () => {
      const onApprove = vi.fn();
      const comments = [createComment('suggestion', '1')];
      render(<ApprovabilityBadge comments={comments} onApprove={onApprove} />);
      expect(screen.getByRole('button', { name: /Approve MR/i })).toBeInTheDocument();
    });

    it('hides approve button when not approvable', () => {
      const onApprove = vi.fn();
      const comments = [createComment('critical', '1')];
      render(<ApprovabilityBadge comments={comments} onApprove={onApprove} />);
      expect(screen.queryByRole('button', { name: /Approve MR/i })).not.toBeInTheDocument();
    });

    it('hides approve button when no callback provided', () => {
      const comments = [createComment('suggestion', '1')];
      render(<ApprovabilityBadge comments={comments} />);
      expect(screen.queryByRole('button', { name: /Approve MR/i })).not.toBeInTheDocument();
    });

    it('calls onApprove when button is clicked', () => {
      const onApprove = vi.fn();
      const comments = [createComment('suggestion', '1')];
      render(<ApprovabilityBadge comments={comments} onApprove={onApprove} />);

      fireEvent.click(screen.getByRole('button', { name: /Approve MR/i }));
      expect(onApprove).toHaveBeenCalledTimes(1);
    });
  });
});
