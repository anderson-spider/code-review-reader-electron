/// <reference types="vitest/globals" />
import '@testing-library/jest-dom/vitest';

// Mock localStorage (must be before any imports that use it)
const createMockLocalStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    }),
  };
};

export const mockLocalStorage = createMockLocalStorage();
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage, writable: true });

// Mock scrollIntoView (not implemented in JSDOM)
Element.prototype.scrollIntoView = vi.fn();

// Mock matchMedia (used by appStore for dark mode detection)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('dark'),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock window.electronAPI for all tests
global.window.electronAPI = {
  app: {
    openExternal: vi.fn().mockResolvedValue(undefined),
    getVersion: vi.fn().mockResolvedValue('1.0.0'),
    getPlatform: vi.fn().mockResolvedValue('darwin'),
  },
  gitlab: {
    init: vi.fn().mockResolvedValue(undefined),
    reinit: vi.fn().mockResolvedValue(undefined),
    parseURL: vi.fn(),
    fetchMR: vi.fn(),
    fetchChanges: vi.fn(),
    fetchProject: vi.fn().mockResolvedValue({
      id: 1,
      name: 'test-project',
      path: 'test-project',
      path_with_namespace: 'group/test-project',
      ssh_url_to_repo: 'git@gitlab.com:group/test-project.git',
      http_url_to_repo: 'https://gitlab.com/group/test-project.git',
      default_branch: 'main',
    }),
    postComment: vi.fn(),
    postLineComment: vi.fn(),
    deleteMyComments: vi.fn(),
    fetchExistingComments: vi.fn(),
    approveMR: vi.fn(),
    fetchFile: vi.fn().mockResolvedValue(null),
  },
  review: {
    generateReview: vi.fn(),
    generateParallelReview: vi.fn(),
    refineComment: vi.fn().mockResolvedValue({
      refinedComment: 'Refined comment text',
      refinedCodeSnippet: null,
    }),
  },
  repository: {
    clone: vi.fn().mockResolvedValue('/tmp/test-repo'),
    readContext: vi.fn().mockResolvedValue({
      changedFiles: [],
      relatedFiles: [],
      projectStructure: { directories: [], fileCount: 0, tree: '' },
      repoPath: '/tmp/test-repo',
    }),
    cleanup: vi.fn().mockResolvedValue(undefined),
  },
  config: {
    saveToken: vi.fn(),
    getToken: vi.fn(),
    hasToken: vi.fn(),
    deleteToken: vi.fn(),
    getProxySettings: vi.fn().mockResolvedValue({ enabled: false, type: 'none', host: '', port: 1080 }),
    setProxySettings: vi.fn().mockResolvedValue(undefined),
    resetProxySettings: vi.fn().mockResolvedValue(undefined),
    // Prompt profile operations
    getPromptConfig: vi.fn().mockResolvedValue({
      profiles: [{ id: 'default', name: 'Padrão', customInstructions: 'You are a Senior Software Engineer...' }],
      activeProfileId: 'default',
    }),
    setPromptConfig: vi.fn().mockResolvedValue(undefined),
    getActivePromptProfile: vi.fn().mockResolvedValue({
      id: 'default',
      name: 'Padrão',
      customInstructions: 'You are a Senior Software Engineer...',
    }),
    savePromptProfile: vi.fn().mockResolvedValue(undefined),
    deletePromptProfile: vi.fn().mockResolvedValue(undefined),
    setActivePromptProfile: vi.fn().mockResolvedValue(undefined),
    resetPromptConfig: vi.fn().mockResolvedValue(undefined),
    getMemorySettings: vi.fn().mockResolvedValue({
      smfsBinaryPath: 'smfs',
      supermemoryBinaryPath: 'supermemory',
      projects: [],
    }),
    setMemorySettings: vi.fn().mockResolvedValue(undefined),
  },
  memory: {
    listContainers: vi.fn().mockResolvedValue({ status: 'ready', containers: [] }),
  },
  onReviewProgress: vi.fn().mockReturnValue(() => {}),
  onRepositoryProgress: vi.fn().mockReturnValue(() => {}),
  onLogEntry: vi.fn().mockReturnValue(() => {}),
};
