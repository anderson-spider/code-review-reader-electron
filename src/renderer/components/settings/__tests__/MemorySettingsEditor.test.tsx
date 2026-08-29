import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemorySettingsEditor } from '../MemorySettingsEditor';

describe('MemorySettingsEditor', () => {
  beforeEach(() => {
    vi.mocked(window.electronAPI.config.getMemorySettings).mockResolvedValue({
      smfsBinaryPath: '/opt/bin/smfs',
      supermemoryBinaryPath: '/opt/bin/supermemory',
      projects: [],
    });
  });

  it('edits only the CLI binary paths and preserves project mappings', async () => {
    render(<MemorySettingsEditor />);
    await screen.findByDisplayValue('/opt/bin/smfs');

    fireEvent.change(screen.getByLabelText('Supermemory binary'), {
      target: { value: '/usr/local/bin/supermemory' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save memory tools' }));

    await waitFor(() => expect(window.electronAPI.config.setMemorySettings).toHaveBeenCalledWith({
      smfsBinaryPath: '/opt/bin/smfs',
      supermemoryBinaryPath: '/usr/local/bin/supermemory',
      projects: [],
    }));
  });
});
