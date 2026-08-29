// -----------------------------------------------------------------------------
// Settings Types
// -----------------------------------------------------------------------------

import type { ProxySettings } from './proxy';

export interface AppSettings {
  gitlabBaseURL: string;
  lastMRURL: string;
  proxy: ProxySettings;
}

export interface ProjectMemoryMapping {
  enabled: boolean;
  projectUrl: string;
  containerTag: string;
}

export interface MemorySettings {
  smfsBinaryPath: string;
  supermemoryBinaryPath: string;
  projects: ProjectMemoryMapping[];
}

export interface MemoryContainer {
  containerTag: string;
  name: string;
  documentCount: number;
  memoryCount: number;
  lastActivityAt?: string | null;
}

export type MemoryContainerListStatus =
  | 'ready'
  | 'not_authenticated'
  | 'unavailable'
  | 'invalid_output';

export interface MemoryContainerListResult {
  containers: MemoryContainer[];
  status: MemoryContainerListStatus;
}

export const DEFAULT_MEMORY_SETTINGS: MemorySettings = {
  smfsBinaryPath: 'smfs',
  supermemoryBinaryPath: 'supermemory',
  projects: [],
};

export interface PostResult {
  success: boolean;
  message: string;
  successCount?: number;
  failureCount?: number;
  skippedCount?: number;
}

// -----------------------------------------------------------------------------
// Settings Screen Types
// -----------------------------------------------------------------------------

/** Settings navigation categories */
export type SettingsCategory =
  | 'gitlab'
  | 'proxy'
  | 'codex'
  | 'appearance'
  | 'about';

/** Application view states */
export type AppView = 'main' | 'settings';

/** Theme preference options */
export type ThemePreference = 'light' | 'dark' | 'system';

/** Font size options */
export type FontSize = 'small' | 'medium' | 'large';

/** Appearance settings */
export interface AppearanceSettings {
  theme: ThemePreference;
  fontSize: FontSize;
}

/** Settings section message type */
export type SaveMessage = {
  type: 'success' | 'error';
  text: string;
} | null;

/** Uniform interface for settings sections */
export interface SettingsSectionProps {
  onMessage?: (message: SaveMessage) => void;
}
