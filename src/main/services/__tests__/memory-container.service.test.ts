import { describe, expect, it, vi } from 'vitest';
import { SupermemoryContainerService } from '../memory-container.service';

describe('SupermemoryContainerService', () => {
  it('lists and sorts validated containers through a shell-free argument contract', async () => {
    const runner = vi.fn(async () => ({ stdout: JSON.stringify([
      { containerTag: 'repo_z__2', name: 'Zulu', documentCount: 1, memoryCount: 2, lastActivityAt: null },
      { containerTag: 'repo_a__1', name: 'Alpha', documentCount: 3, memoryCount: 4 },
    ]) }));
    const service = new SupermemoryContainerService(runner);

    await expect(service.list('/opt/bin/supermemory')).resolves.toEqual({
      status: 'ready',
      containers: [
        { containerTag: 'repo_a__1', name: 'Alpha', documentCount: 3, memoryCount: 4 },
        { containerTag: 'repo_z__2', name: 'Zulu', documentCount: 1, memoryCount: 2, lastActivityAt: null },
      ],
    });
    expect(runner).toHaveBeenCalledWith('/opt/bin/supermemory', ['tags', 'list', '--json']);
  });

  it.each([
    ['invalid_output', vi.fn(async () => ({ stdout: '{invalid' }))],
    ['invalid_output', vi.fn(async () => ({ stdout: JSON.stringify([{ containerTag: '' }]) }))],
    ['invalid_output', vi.fn(async () => ({ stdout: JSON.stringify([
      { containerTag: 'duplicate', name: 'One', documentCount: 1, memoryCount: 2 },
      { containerTag: 'duplicate', name: 'Two', documentCount: 3, memoryCount: 4 },
    ]) }))],
    ['invalid_output', vi.fn(async () => ({ stdout: JSON.stringify([
      { containerTag: 'invalid-count', name: 'Invalid', documentCount: -1, memoryCount: 2 },
    ]) }))],
    ['not_authenticated', vi.fn(async () => { throw Object.assign(new Error('failed'), { stderr: 'Not authenticated' }); })],
    ['not_authenticated', vi.fn(async () => { throw new Error('HTTP 401: authentication required'); })],
    ['unavailable', vi.fn(async () => { throw new Error('ENOENT'); })],
  ] as const)('returns sanitized %s status', async (status, runner) => {
    const service = new SupermemoryContainerService(runner);
    await expect(service.list('supermemory')).resolves.toEqual({ status, containers: [] });
  });
});
