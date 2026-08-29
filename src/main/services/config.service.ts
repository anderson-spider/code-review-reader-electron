import Store from 'electron-store';
import type { MemorySettings, ProxySettings, ProxyType, PromptProfile, PromptConfig } from '../../shared/types';
import {
  DEFAULT_MEMORY_SETTINGS,
  DEFAULT_PROXY_SETTINGS,
  DEFAULT_PROMPT_CONFIG,
} from '../../shared/types';

interface ConfigSchema {
  gitlabToken: string;
  gitlabBaseURL: string;
  proxyEnabled: boolean;
  proxyType: ProxyType;
  proxyHost: string;
  proxyPort: number;
  promptProfiles: string; // JSON string of PromptProfile[]
  activePromptProfileId: string;
  memorySettings: string;
}

const schema = {
  gitlabToken: {
    type: 'string' as const,
    default: '',
  },
  gitlabBaseURL: {
    type: 'string' as const,
    default: 'https://gitlab.com/api/v4',
  },
  proxyEnabled: {
    type: 'boolean' as const,
    default: false,
  },
  proxyType: {
    type: 'string' as const,
    enum: ['none', 'socks5', 'http'] as string[],
    default: 'none',
  },
  proxyHost: {
    type: 'string' as const,
    default: '',
  },
  proxyPort: {
    type: 'number' as const,
    default: 1080,
  },
  promptProfiles: {
    type: 'string' as const,
    default: JSON.stringify(DEFAULT_PROMPT_CONFIG.profiles),
  },
  activePromptProfileId: {
    type: 'string' as const,
    default: 'default',
  },
  memorySettings: {
    type: 'string' as const,
    default: JSON.stringify(DEFAULT_MEMORY_SETTINGS),
  },
};

export class ConfigService {
  private store: Store<ConfigSchema>;

  constructor() {
    this.store = new Store<ConfigSchema>({
      name: 'config',
      schema,
      encryptionKey: 'code-review-reader-v1', // Simple obfuscation
    });
  }

  // GitLab Token
  saveGitLabToken(token: string): void {
    // Sanitize token: remove newlines, carriage returns, and trim whitespace
    // This prevents "Invalid header received from client" errors
    const sanitized = token.replace(/[\r\n]/g, '').trim();
    this.store.set('gitlabToken', sanitized);
  }

  getGitLabToken(): string | null {
    const token = this.store.get('gitlabToken');
    if (!token || token.length === 0) {
      return null;
    }
    // Extra safety: sanitize on retrieval in case of legacy stored tokens
    return token.replace(/[\r\n]/g, '').trim() || null;
  }

  hasGitLabToken(): boolean {
    const token = this.getGitLabToken();
    return token !== null;
  }

  deleteGitLabToken(): void {
    this.store.delete('gitlabToken');
  }

  // GitLab Base URL
  getGitLabBaseURL(): string {
    return this.store.get('gitlabBaseURL');
  }

  setGitLabBaseURL(url: string): void {
    this.store.set('gitlabBaseURL', url);
  }

  // Proxy Settings
  getProxySettings(): ProxySettings {
    return {
      enabled: this.store.get('proxyEnabled'),
      type: this.store.get('proxyType'),
      host: this.store.get('proxyHost'),
      port: this.store.get('proxyPort'),
    };
  }

  setProxySettings(settings: ProxySettings): void {
    this.store.set('proxyEnabled', settings.enabled);
    this.store.set('proxyType', settings.type);
    this.store.set('proxyHost', settings.host);
    this.store.set('proxyPort', settings.port);
  }

  resetProxySettings(): void {
    this.setProxySettings(DEFAULT_PROXY_SETTINGS);
  }

  // Prompt Profiles
  getPromptConfig(): PromptConfig {
    try {
      const profilesJson = this.store.get('promptProfiles');
      const profiles: PromptProfile[] = JSON.parse(profilesJson);
      const activeProfileId = this.store.get('activePromptProfileId');
      return { profiles, activeProfileId };
    } catch {
      return DEFAULT_PROMPT_CONFIG;
    }
  }

  setPromptConfig(config: PromptConfig): void {
    this.store.set('promptProfiles', JSON.stringify(config.profiles));
    this.store.set('activePromptProfileId', config.activeProfileId);
  }

  getActivePromptProfile(): PromptProfile {
    const config = this.getPromptConfig();
    const active = config.profiles.find((p) => p.id === config.activeProfileId);
    return active || DEFAULT_PROMPT_CONFIG.profiles[0];
  }

  savePromptProfile(profile: PromptProfile): void {
    const config = this.getPromptConfig();
    const existingIndex = config.profiles.findIndex((p) => p.id === profile.id);

    if (existingIndex >= 0) {
      config.profiles[existingIndex] = profile;
    } else {
      config.profiles.push(profile);
    }

    this.setPromptConfig(config);
  }

  deletePromptProfile(profileId: string): void {
    // Cannot delete the default profile
    if (profileId === 'default') return;

    const config = this.getPromptConfig();
    config.profiles = config.profiles.filter((p) => p.id !== profileId);

    // If we deleted the active profile, switch to default
    if (config.activeProfileId === profileId) {
      config.activeProfileId = 'default';
    }

    this.setPromptConfig(config);
  }

  setActivePromptProfile(profileId: string): void {
    const config = this.getPromptConfig();
    const exists = config.profiles.some((p) => p.id === profileId);

    if (exists) {
      config.activeProfileId = profileId;
      this.setPromptConfig(config);
    }
  }

  resetPromptConfig(): void {
    this.setPromptConfig(DEFAULT_PROMPT_CONFIG);
  }

  getMemorySettings(): MemorySettings {
    try {
      return this.normalizeMemorySettings(JSON.parse(this.store.get('memorySettings')));
    } catch {
      return DEFAULT_MEMORY_SETTINGS;
    }
  }

  setMemorySettings(settings: MemorySettings): void {
    this.store.set('memorySettings', JSON.stringify(this.normalizeMemorySettings(settings)));
  }

  private normalizeMemorySettings(settings: MemorySettings): MemorySettings {
    if (!settings || !Array.isArray(settings.projects)) throw new Error('Invalid memory settings');
    const smfsBinaryPath = settings.smfsBinaryPath?.trim();
    if (!smfsBinaryPath) throw new Error('SMFS binary path is required');
    const supermemoryBinaryPath = settings.supermemoryBinaryPath?.trim() || 'supermemory';
    const projects = settings.projects.map((project) => {
      if (!project || typeof project.enabled !== 'boolean') throw new Error('Invalid project mapping');
      const projectUrl = project.projectUrl?.trim().replace(/\/$/, '');
      const containerTag = project.containerTag?.trim();
      if (!projectUrl || (project.enabled && !containerTag)) {
        throw new Error('Project URL and enabled container tag are required');
      }
      return { enabled: project.enabled, projectUrl, containerTag: containerTag || '' };
    });
    if (new Set(projects.map((project) => project.projectUrl)).size !== projects.length) {
      throw new Error('Project URLs must be unique');
    }
    return {
      smfsBinaryPath,
      supermemoryBinaryPath,
      projects,
    };
  }

  // Clear all config
  clearAll(): void {
    this.store.clear();
  }
}
