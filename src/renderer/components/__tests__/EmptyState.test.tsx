import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('renders the title', () => {
    render(<EmptyState />);
    expect(screen.getByText('No review loaded')).toBeInTheDocument();
  });

  it('renders the description', () => {
    render(<EmptyState />);
    expect(screen.getByText(/Paste a GitLab MR URL above/i)).toBeInTheDocument();
  });

  it('renders the hint text', () => {
    render(<EmptyState />);
    expect(screen.getByText(/Press \? for keyboard shortcuts/i)).toBeInTheDocument();
  });

  it('has accessible structure', () => {
    const { container } = render(<EmptyState />);
    // Should have a heading
    expect(container.querySelector('h3')).toBeInTheDocument();
    // Should have descriptive text
    expect(container.querySelector('p')).toBeInTheDocument();
  });
});
