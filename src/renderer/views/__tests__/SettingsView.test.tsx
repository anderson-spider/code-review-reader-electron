import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsView } from '../SettingsView';

describe('SettingsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.electronAPI.config.hasToken = vi.fn().mockResolvedValue(false);
  });

  it('should expose Codex as the only review engine settings category', () => {
    render(<SettingsView />);

    expect(screen.getByRole('button', { name: /Codex.*App Server e prompts/i })).toBeInTheDocument();
    expect(screen.queryByText(/Copilot/i)).not.toBeInTheDocument();
  });
});
