import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CodexSection } from '../CodexSection';

vi.mock('../../PromptProfileEditor', () => ({
  PromptProfileEditor: () => <div>Prompt profiles</div>,
}));

vi.mock('../../MemorySettingsEditor', () => ({
  MemorySettingsEditor: () => <div>Memory settings</div>,
}));

describe('CodexSection', () => {
  it('shows Codex App Server guidance without provider or model controls', () => {
    render(<CodexSection />);

    expect(screen.getByRole('heading', { name: 'Codex App Server' })).toBeInTheDocument();
    expect(screen.getAllByText(/codex app-server/i)).not.toHaveLength(0);
    expect(screen.getAllByText(/codex login status/i)).not.toHaveLength(0);
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Modelo')).not.toBeInTheDocument();
    expect(screen.getByText('Memory settings')).toBeInTheDocument();
  });
});
