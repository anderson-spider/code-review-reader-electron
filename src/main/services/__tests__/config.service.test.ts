import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigService } from '../config.service';
import { DEFAULT_MEMORY_SETTINGS, DEFAULT_PROMPT_CONFIG } from '../../../shared/types';
import type { PromptProfile, PromptConfig } from '../../../shared/types';

// Mock electron-store with a proper class
const createMockStore = () => {
  const store = new Map<string, unknown>();
  return {
    get: vi.fn<(key: string) => unknown>((key: string) =>
      (store.get(key) as string | null | undefined) ?? (key === 'gitlabBaseURL' ? 'https://gitlab.com/api/v4' : '')
    ),
    set: vi.fn((key: string, value: unknown) => store.set(key, value)),
    delete: vi.fn((key: string) => store.delete(key)),
    clear: vi.fn(() => store.clear()),
    _store: store,
  };
};

let mockStoreInstance: ReturnType<typeof createMockStore>;

vi.mock('electron-store', () => {
  return {
    default: class MockStore {
      get: ReturnType<typeof vi.fn>;
      set: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      clear: ReturnType<typeof vi.fn>;
      _store: Map<string, unknown>;

      constructor() {
        mockStoreInstance = createMockStore();
        this.get = mockStoreInstance.get;
        this.set = mockStoreInstance.set;
        this.delete = mockStoreInstance.delete;
        this.clear = mockStoreInstance.clear;
        this._store = mockStoreInstance._store;
      }
    },
  };
});

describe('ConfigService', () => {
  let service: ConfigService;

  // Helper to get the mock store
  const getMockStore = () => mockStoreInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ConfigService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // GitLab Token Tests
  // =========================================================================
  describe('GitLab Token Management', () => {
    describe('saveGitLabToken', () => {
      it('should save token to store', () => {
        service.saveGitLabToken('glpat-test-token-12345');

        expect(getMockStore().set).toHaveBeenCalledWith('gitlabToken', 'glpat-test-token-12345');
      });

      it('should overwrite existing token', () => {
        service.saveGitLabToken('old-token');
        service.saveGitLabToken('new-token');

        expect(getMockStore().set).toHaveBeenCalledTimes(2);
        expect(getMockStore().set).toHaveBeenLastCalledWith('gitlabToken', 'new-token');
      });

      it('should handle empty token', () => {
        service.saveGitLabToken('');

        expect(getMockStore().set).toHaveBeenCalledWith('gitlabToken', '');
      });

      it('should sanitize token with newlines', () => {
        service.saveGitLabToken('glpat-token\n');

        expect(getMockStore().set).toHaveBeenCalledWith('gitlabToken', 'glpat-token');
      });

      it('should sanitize token with carriage returns', () => {
        service.saveGitLabToken('glpat-token\r\n');

        expect(getMockStore().set).toHaveBeenCalledWith('gitlabToken', 'glpat-token');
      });

      it('should sanitize token with leading/trailing whitespace', () => {
        service.saveGitLabToken('  glpat-token  ');

        expect(getMockStore().set).toHaveBeenCalledWith('gitlabToken', 'glpat-token');
      });

      it('should sanitize token pasted with multiple newlines', () => {
        service.saveGitLabToken('\nglpat-token\n\n');

        expect(getMockStore().set).toHaveBeenCalledWith('gitlabToken', 'glpat-token');
      });
    });

    describe('getGitLabToken', () => {
      it('should return token when it exists', () => {
        getMockStore().get.mockReturnValue('glpat-existing-token');

        const result = service.getGitLabToken();

        expect(result).toBe('glpat-existing-token');
        expect(getMockStore().get).toHaveBeenCalledWith('gitlabToken');
      });

      it('should return null when token is empty string', () => {
        getMockStore().get.mockReturnValue('');

        const result = service.getGitLabToken();

        expect(result).toBeNull();
      });

      it('should return null when token is undefined', () => {
        getMockStore().get.mockReturnValue(undefined);

        const result = service.getGitLabToken();

        expect(result).toBeNull();
      });

      it('should return null when token is null', () => {
        getMockStore().get.mockReturnValue(null);

        const result = service.getGitLabToken();

        expect(result).toBeNull();
      });

      it('should sanitize legacy token with newlines on retrieval', () => {
        getMockStore().get.mockReturnValue('glpat-legacy-token\n');

        const result = service.getGitLabToken();

        expect(result).toBe('glpat-legacy-token');
      });

      it('should return null for token that is only whitespace', () => {
        getMockStore().get.mockReturnValue('   \n\r  ');

        const result = service.getGitLabToken();

        expect(result).toBeNull();
      });
    });

    describe('hasGitLabToken', () => {
      it('should return true when token exists', () => {
        getMockStore().get.mockReturnValue('glpat-token');

        const result = service.hasGitLabToken();

        expect(result).toBe(true);
      });

      it('should return false when token is empty', () => {
        getMockStore().get.mockReturnValue('');

        const result = service.hasGitLabToken();

        expect(result).toBe(false);
      });

      it('should return false when token is undefined', () => {
        getMockStore().get.mockReturnValue(undefined);

        const result = service.hasGitLabToken();

        expect(result).toBe(false);
      });
    });

    describe('deleteGitLabToken', () => {
      it('should delete token from store', () => {
        service.deleteGitLabToken();

        expect(getMockStore().delete).toHaveBeenCalledWith('gitlabToken');
      });
    });
  });

  // =========================================================================
  // GitLab Base URL Tests
  // =========================================================================
  describe('GitLab Base URL Management', () => {
    describe('getGitLabBaseURL', () => {
      it('should return default URL when not set', () => {
        getMockStore().get.mockReturnValue('https://gitlab.com/api/v4');

        const result = service.getGitLabBaseURL();

        expect(result).toBe('https://gitlab.com/api/v4');
        expect(getMockStore().get).toHaveBeenCalledWith('gitlabBaseURL');
      });

      it('should return custom URL when set', () => {
        getMockStore().get.mockReturnValue('https://git.company.com/api/v4');

        const result = service.getGitLabBaseURL();

        expect(result).toBe('https://git.company.com/api/v4');
      });
    });

    describe('setGitLabBaseURL', () => {
      it('should save base URL to store', () => {
        service.setGitLabBaseURL('https://custom-gitlab.com/api/v4');

        expect(getMockStore().set).toHaveBeenCalledWith('gitlabBaseURL', 'https://custom-gitlab.com/api/v4');
      });

      it('should handle self-hosted GitLab URLs', () => {
        service.setGitLabBaseURL('https://git.internal.company.com/api/v4');

        expect(getMockStore().set).toHaveBeenCalledWith('gitlabBaseURL', 'https://git.internal.company.com/api/v4');
      });
    });
  });

  // =========================================================================
  // Clear All Tests
  // =========================================================================
  describe('clearAll', () => {
    it('should clear all config from store', () => {
      service.clearAll();

      expect(getMockStore().clear).toHaveBeenCalled();
    });

    it('should reset token to null after clear', () => {
      getMockStore().get.mockReturnValue('');

      service.clearAll();
      const result = service.getGitLabToken();

      expect(result).toBeNull();
    });
  });

  describe('Memory Settings', () => {
    it('returns defaults when stored JSON is invalid', () => {
      getMockStore().get.mockReturnValue('{invalid');
      expect(service.getMemorySettings()).toEqual(DEFAULT_MEMORY_SETTINGS);
    });

    it('normalizes and stores per-project mappings', () => {
      service.setMemorySettings({
        smfsBinaryPath: ' /opt/bin/smfs ',
        supermemoryBinaryPath: ' /opt/bin/supermemory ',
        projects: [{
          enabled: true,
          projectUrl: ' https://gitlab.com/group/project/ ',
          containerTag: ' project_tag ',
        }],
      });

      expect(getMockStore().set).toHaveBeenCalledWith('memorySettings', JSON.stringify({
        smfsBinaryPath: '/opt/bin/smfs',
        supermemoryBinaryPath: '/opt/bin/supermemory',
        projects: [{
          enabled: true,
          projectUrl: 'https://gitlab.com/group/project',
          containerTag: 'project_tag',
        }],
      }));
    });

    it('rejects incomplete project mappings', () => {
      expect(() => service.setMemorySettings({
        smfsBinaryPath: 'smfs',
        supermemoryBinaryPath: 'supermemory',
        projects: [{ enabled: true, projectUrl: '', containerTag: 'tag' }],
      })).toThrow('Project URL and enabled container tag are required');
    });

    it('migrates legacy mappings by dropping mountPath and defaulting the discovery binary', () => {
      getMockStore().get.mockReturnValue(JSON.stringify({
        smfsBinaryPath: 'smfs',
        projects: [{
          enabled: true,
          projectUrl: 'https://gitlab.com/group/project',
          containerTag: 'tag',
          mountPath: './legacy-memory',
        }],
      }));

      expect(service.getMemorySettings()).toEqual({
        smfsBinaryPath: 'smfs',
        supermemoryBinaryPath: 'supermemory',
        projects: [{
          enabled: true,
          projectUrl: 'https://gitlab.com/group/project',
          containerTag: 'tag',
        }],
      });
    });
  });

  // =========================================================================
  // Integration Tests
  // =========================================================================
  describe('Integration Scenarios', () => {
    it('should handle complete token lifecycle', () => {
      // Initially no token
      getMockStore().get.mockReturnValue('');
      expect(service.hasGitLabToken()).toBe(false);

      // Save token
      service.saveGitLabToken('glpat-new-token');
      getMockStore().get.mockReturnValue('glpat-new-token');
      expect(service.hasGitLabToken()).toBe(true);
      expect(service.getGitLabToken()).toBe('glpat-new-token');

      // Delete token
      service.deleteGitLabToken();
      getMockStore().get.mockReturnValue('');
      expect(service.hasGitLabToken()).toBe(false);
      expect(service.getGitLabToken()).toBeNull();
    });

    it('should handle config with both token and URL', () => {
      service.saveGitLabToken('glpat-token');
      service.setGitLabBaseURL('https://git.company.com/api/v4');

      expect(getMockStore().set).toHaveBeenCalledWith('gitlabToken', 'glpat-token');
      expect(getMockStore().set).toHaveBeenCalledWith('gitlabBaseURL', 'https://git.company.com/api/v4');
    });
  });

  // =========================================================================
  // Proxy Settings Tests
  // =========================================================================
  describe('Proxy Settings', () => {
    it('should return all proxy fields from store', () => {
      getMockStore().get.mockImplementation((key: string) => {
        const values: Record<string, unknown> = {
          proxyEnabled: true,
          proxyType: 'socks5',
          proxyHost: '127.0.0.1',
          proxyPort: 9050,
        };
        return values[key] ?? '';
      });

      const result = service.getProxySettings();

      expect(result).toEqual({
        enabled: true,
        type: 'socks5',
        host: '127.0.0.1',
        port: 9050,
      });
    });

    it('should store all 4 proxy fields via setProxySettings', () => {
      service.setProxySettings({
        enabled: true,
        type: 'http',
        host: 'proxy.company.com',
        port: 8080,
      });

      expect(getMockStore().set).toHaveBeenCalledWith('proxyEnabled', true);
      expect(getMockStore().set).toHaveBeenCalledWith('proxyType', 'http');
      expect(getMockStore().set).toHaveBeenCalledWith('proxyHost', 'proxy.company.com');
      expect(getMockStore().set).toHaveBeenCalledWith('proxyPort', 8080);
    });

    it('should reset proxy to defaults', () => {
      service.resetProxySettings();

      expect(getMockStore().set).toHaveBeenCalledWith('proxyEnabled', false);
      expect(getMockStore().set).toHaveBeenCalledWith('proxyType', 'none');
      expect(getMockStore().set).toHaveBeenCalledWith('proxyHost', '');
      expect(getMockStore().set).toHaveBeenCalledWith('proxyPort', 1080);
    });

    it('should handle socks5 proxy type', () => {
      service.setProxySettings({
        enabled: true,
        type: 'socks5',
        host: 'localhost',
        port: 1080,
      });

      expect(getMockStore().set).toHaveBeenCalledWith('proxyType', 'socks5');
    });

    it('should handle disabled proxy with populated fields', () => {
      service.setProxySettings({
        enabled: false,
        type: 'http',
        host: 'proxy.example.com',
        port: 3128,
      });

      expect(getMockStore().set).toHaveBeenCalledWith('proxyEnabled', false);
      expect(getMockStore().set).toHaveBeenCalledWith('proxyHost', 'proxy.example.com');
    });
  });

  // =========================================================================
  // Prompt Profiles Tests
  // =========================================================================
  describe('Prompt Profiles', () => {
    const defaultProfile: PromptProfile = {
      id: 'default',
      name: 'Padrão',
      customInstructions: 'Default instructions',
      isDefault: true,
    };

    const customProfile: PromptProfile = {
      id: 'custom-1',
      name: 'Security Focus',
      customInstructions: 'Focus on security vulnerabilities',
    };

    const anotherProfile: PromptProfile = {
      id: 'custom-2',
      name: 'Performance Review',
      customInstructions: 'Focus on performance issues',
    };

    /**
     * Helper: configure mock store get to return specific prompt data.
     */
    const setupPromptMock = (profiles: PromptProfile[], activeId: string) => {
      getMockStore().get.mockImplementation((key: string) => {
        if (key === 'promptProfiles') return JSON.stringify(profiles);
        if (key === 'activePromptProfileId') return activeId;
        return '';
      });
    };

    /**
     * Helper: configure mock store to use the internal Map for persistence,
     * seeded with the given prompt data.
     */
    const setupPersistentPromptStore = (profiles: PromptProfile[], activeId: string) => {
      getMockStore()._store.set('promptProfiles', JSON.stringify(profiles));
      getMockStore()._store.set('activePromptProfileId', activeId);
      getMockStore().get.mockImplementation((key: string) => {
        const value = getMockStore()._store.get(key);
        return value !== undefined ? value : '';
      });
    };

    describe('getPromptConfig', () => {
      it('should return parsed profiles and activeProfileId from store', () => {
        setupPromptMock([defaultProfile, customProfile], 'custom-1');

        const result = service.getPromptConfig();

        expect(result.profiles).toHaveLength(2);
        expect(result.profiles[0]).toEqual(defaultProfile);
        expect(result.profiles[1]).toEqual(customProfile);
        expect(result.activeProfileId).toBe('custom-1');
      });

      it('should return DEFAULT_PROMPT_CONFIG when JSON is invalid', () => {
        getMockStore().get.mockImplementation((key: string) => {
          if (key === 'promptProfiles') return '{invalid-json';
          if (key === 'activePromptProfileId') return 'default';
          return '';
        });

        const result = service.getPromptConfig();

        expect(result).toEqual(DEFAULT_PROMPT_CONFIG);
      });

      it('should return DEFAULT_PROMPT_CONFIG when store returns empty', () => {
        getMockStore().get.mockReturnValue('');

        const result = service.getPromptConfig();

        expect(result).toEqual(DEFAULT_PROMPT_CONFIG);
      });
    });

    describe('setPromptConfig', () => {
      it('should store JSON-stringified profiles and activeProfileId', () => {
        const config: PromptConfig = {
          profiles: [defaultProfile, customProfile],
          activeProfileId: 'custom-1',
        };

        service.setPromptConfig(config);

        expect(getMockStore().set).toHaveBeenCalledWith(
          'promptProfiles',
          JSON.stringify([defaultProfile, customProfile])
        );
        expect(getMockStore().set).toHaveBeenCalledWith('activePromptProfileId', 'custom-1');
      });

      it('should round-trip: set then get returns same config', () => {
        const config: PromptConfig = {
          profiles: [defaultProfile, customProfile],
          activeProfileId: 'custom-1',
        };

        setupPersistentPromptStore([], 'default');
        service.setPromptConfig(config);

        const result = service.getPromptConfig();

        expect(result.profiles).toEqual(config.profiles);
        expect(result.activeProfileId).toBe(config.activeProfileId);
      });
    });

    describe('getActivePromptProfile', () => {
      it('should return matching active profile', () => {
        setupPromptMock([defaultProfile, customProfile], 'custom-1');

        const result = service.getActivePromptProfile();

        expect(result).toEqual(customProfile);
      });

      it('should return default profile when active ID does not match', () => {
        setupPromptMock([defaultProfile, customProfile], 'nonexistent-id');

        const result = service.getActivePromptProfile();

        expect(result).toEqual(DEFAULT_PROMPT_CONFIG.profiles[0]);
      });

      it('should return default when no profiles exist (fallback)', () => {
        getMockStore().get.mockReturnValue('');

        const result = service.getActivePromptProfile();

        expect(result).toEqual(DEFAULT_PROMPT_CONFIG.profiles[0]);
      });
    });

    describe('savePromptProfile', () => {
      it('should update existing profile by ID', () => {
        setupPersistentPromptStore([defaultProfile, customProfile], 'default');

        const updatedCustom: PromptProfile = {
          ...customProfile,
          name: 'Updated Security',
          customInstructions: 'Updated instructions',
        };

        service.savePromptProfile(updatedCustom);

        const result = service.getPromptConfig();
        const saved = result.profiles.find((p) => p.id === 'custom-1');
        expect(saved?.name).toBe('Updated Security');
        expect(saved?.customInstructions).toBe('Updated instructions');
      });

      it('should add new profile when ID does not exist', () => {
        setupPersistentPromptStore([defaultProfile], 'default');

        service.savePromptProfile(customProfile);

        const result = service.getPromptConfig();
        expect(result.profiles).toHaveLength(2);
        expect(result.profiles[1]).toEqual(customProfile);
      });

      it('should preserve other profiles when saving', () => {
        setupPersistentPromptStore([defaultProfile, customProfile], 'default');

        service.savePromptProfile(anotherProfile);

        const result = service.getPromptConfig();
        expect(result.profiles).toHaveLength(3);
        expect(result.profiles[0]).toEqual(defaultProfile);
        expect(result.profiles[1]).toEqual(customProfile);
        expect(result.profiles[2]).toEqual(anotherProfile);
      });
    });

    describe('deletePromptProfile', () => {
      it('should remove profile by ID', () => {
        setupPersistentPromptStore([defaultProfile, customProfile], 'default');

        service.deletePromptProfile('custom-1');

        const result = service.getPromptConfig();
        expect(result.profiles).toHaveLength(1);
        expect(result.profiles[0]).toEqual(defaultProfile);
      });

      it('should not delete the default profile', () => {
        setupPersistentPromptStore([defaultProfile, customProfile], 'default');

        service.deletePromptProfile('default');

        const result = service.getPromptConfig();
        expect(result.profiles).toHaveLength(2);
        expect(result.profiles.find((p) => p.id === 'default')).toBeDefined();
      });

      it('should switch active to default when deleting the active profile', () => {
        setupPersistentPromptStore([defaultProfile, customProfile], 'custom-1');

        service.deletePromptProfile('custom-1');

        const result = service.getPromptConfig();
        expect(result.activeProfileId).toBe('default');
        expect(result.profiles.find((p) => p.id === 'custom-1')).toBeUndefined();
      });

      it('should not change active when deleting non-active profile', () => {
        setupPersistentPromptStore([defaultProfile, customProfile, anotherProfile], 'custom-1');

        service.deletePromptProfile('custom-2');

        const result = service.getPromptConfig();
        expect(result.activeProfileId).toBe('custom-1');
        expect(result.profiles).toHaveLength(2);
      });
    });

    describe('setActivePromptProfile', () => {
      it('should set active profile when ID exists', () => {
        setupPersistentPromptStore([defaultProfile, customProfile], 'default');

        service.setActivePromptProfile('custom-1');

        const result = service.getPromptConfig();
        expect(result.activeProfileId).toBe('custom-1');
      });

      it('should do nothing when ID does not exist', () => {
        setupPersistentPromptStore([defaultProfile], 'default');

        service.setActivePromptProfile('nonexistent');

        const result = service.getPromptConfig();
        expect(result.activeProfileId).toBe('default');
      });
    });

    describe('resetPromptConfig', () => {
      it('should reset to DEFAULT_PROMPT_CONFIG', () => {
        service.resetPromptConfig();

        expect(getMockStore().set).toHaveBeenCalledWith(
          'promptProfiles',
          JSON.stringify(DEFAULT_PROMPT_CONFIG.profiles)
        );
        expect(getMockStore().set).toHaveBeenCalledWith('activePromptProfileId', 'default');
      });
    });
  });

});
