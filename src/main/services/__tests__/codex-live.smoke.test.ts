import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CodexAppServerClient } from '../codex-app-server.client';

const liveTest = process.env.CODEX_LIVE_TEST === '1' ? it : it.skip;

describe('Codex App Server live smoke', () => {
  liveTest('should complete the real initialize, thread, and structured turn lifecycle', async () => {
    const client = await CodexAppServerClient.create({ timeoutMs: 120_000 });
    const workingDirectory = client.workingDirectory;

    try {
      const threadId = await client.startThread();
      const output = await client.runTurn({
        threadId,
        input: 'Return a JSON object with ok set to true. Do not include any other fields.',
        outputSchema: {
          type: 'object',
          properties: { ok: { type: 'boolean', const: true } },
          required: ['ok'],
          additionalProperties: false,
        },
      });

      expect(JSON.parse(output)).toEqual({ ok: true });
    } finally {
      await client.close();
    }

    expect(existsSync(workingDirectory)).toBe(false);
  }, 130_000);
});
