import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Readable, Writable } from 'node:stream';

export interface AppServerProcess {
  readonly stdin: Writable;
  readonly stdout: Readable;
  readonly stderr: Readable;
  kill(signal?: NodeJS.Signals | number): boolean;
  once(event: 'error', listener: (error: Error) => void): this;
  once(event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
}

export type AppServerClientDependencies = {
  readonly spawnProcess: (command: string, args: readonly string[], cwd: string) => AppServerProcess;
  readonly createTempDirectory: () => Promise<string>;
  readonly removeTempDirectory: (path: string) => Promise<void>;
};

export type CreateAppServerClientOptions = {
  readonly codexBinary?: string;
  readonly timeoutMs?: number;
  readonly dependencies?: AppServerClientDependencies;
};

export const defaultAppServerClientDependencies: AppServerClientDependencies = {
  spawnProcess: (command, args, cwd) => spawn(command, [...args], {
    cwd,
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
  }),
  createTempDirectory: () => mkdtemp(join(tmpdir(), 'code-review-reader-codex-')),
  removeTempDirectory: (path) => rm(path, { recursive: true, force: true }),
};
