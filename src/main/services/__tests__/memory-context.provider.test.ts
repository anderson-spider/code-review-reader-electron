import { describe, expect, it, vi } from 'vitest';
import { mockModifiedFile, mockOpenMR } from '../../../test/fixtures';
import { SmfsMemoryContextProvider } from '../memory-context.provider';

const settings = {
  smfsBinaryPath: '/opt/bin/smfs',
  supermemoryBinaryPath: '/opt/bin/supermemory',
  projects: [{
    enabled: true,
    projectUrl: 'https://gitlab.com/namespace/project',
    containerTag: 'repo_test_project__123',
  }],
};

describe('SmfsMemoryContextProvider', () => {
  it('uses the matching project tag with a shell-free argument contract', async () => {
    const runner = vi.fn(async () => 'relevant project context');
    const provider = new SmfsMemoryContextProvider(runner);

    await expect(provider.retrieve({ mr: mockOpenMR, changes: [mockModifiedFile], settings }))
      .resolves.toBe('relevant project context');
    expect(runner).toHaveBeenCalledWith(
      '/opt/bin/smfs',
      expect.arrayContaining(['grep', '--tag', 'repo_test_project__123']),
    );
  });

  it('does not query disabled or non-matching projects', async () => {
    const runner = vi.fn(async () => 'context');
    const provider = new SmfsMemoryContextProvider(runner);

    await expect(provider.retrieve({
      mr: mockOpenMR,
      changes: [mockModifiedFile],
      settings: { ...settings, projects: [{ ...settings.projects[0], enabled: false }] },
    })).resolves.toBeNull();
    expect(runner).not.toHaveBeenCalled();
  });

  it('uses an explicit UI tag without requiring a persisted mapping', async () => {
    const runner = vi.fn(async () => 'context');
    const provider = new SmfsMemoryContextProvider(runner);

    await expect(provider.retrieve({
      mr: mockOpenMR,
      changes: [mockModifiedFile],
      settings: { ...settings, projects: [] },
      containerTag: 'repo_ui_override__456',
    })).resolves.toBe('context');
    expect(runner).toHaveBeenCalledWith('/opt/bin/smfs', expect.arrayContaining([
      'grep', '--tag', 'repo_ui_override__456',
    ]));
  });

  it('treats an explicit null tag as memory disabled for the review', async () => {
    const runner = vi.fn(async () => 'context');
    const provider = new SmfsMemoryContextProvider(runner);

    await expect(provider.retrieve({
      mr: mockOpenMR,
      changes: [mockModifiedFile],
      settings,
      containerTag: null,
    })).resolves.toBeNull();
    expect(runner).not.toHaveBeenCalled();
  });

  it.each([
    ['command failure', vi.fn(async () => { throw new Error('secret stderr'); })],
    ['empty output', vi.fn(async () => '  ')],
    ['oversized output', vi.fn(async () => 'x'.repeat(16_001))],
  ])('fails open for %s', async (_case, runner) => {
    const provider = new SmfsMemoryContextProvider(runner);
    await expect(provider.retrieve({ mr: mockOpenMR, changes: [mockModifiedFile], settings }))
      .resolves.toBeNull();
  });
});
