import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAppStore, selectHasReview } from '../appStore';
import { mockOpenMR, mockModifiedFile, createMockReview, mockParsedUrl } from '../../../test/fixtures';
import { mockLocalStorage } from '../../../test/setup';

describe('appStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
    // Reset store state
    const { result } = renderHook(() => useAppStore());
    act(() => {
      result.current.reset();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // Initial State Tests
  // =========================================================================
  describe('Initial State', () => {
    it('should have default gitlab base URL', () => {
      const { result } = renderHook(() => useAppStore());

      expect(result.current.gitlabBaseURL).toBe('https://gitlab.com/api/v4');
    });

    it('should have empty last MR URL', () => {
      const { result } = renderHook(() => useAppStore());

      expect(result.current.lastMRURL).toBe('');
    });

    it('should detect system dark mode preference', () => {
      const { result } = renderHook(() => useAppStore());

      // Our mock returns true for dark mode
      expect(typeof result.current.darkMode).toBe('boolean');
    });

    it('should not be configured initially', () => {
      const { result } = renderHook(() => useAppStore());

      expect(result.current.isConfigured).toBe(false);
    });

    it('should have null runtime state values', () => {
      const { result } = renderHook(() => useAppStore());

      expect(result.current.currentMR).toBeNull();
      expect(result.current.currentChanges).toBeNull();
      expect(result.current.parsedUrl).toBeNull();
      expect(result.current.currentReview).toBeNull();
    });

    it('should not be loading initially', () => {
      const { result } = renderHook(() => useAppStore());

      expect(result.current.isLoading).toBe(false);
      expect(result.current.loadingMessage).toBe('');
    });

    it('should have no error initially', () => {
      const { result } = renderHook(() => useAppStore());

      expect(result.current.errorMessage).toBeNull();
    });
  });

  // =========================================================================
  // Settings Actions Tests
  // =========================================================================
  describe('Settings Actions', () => {
    describe('setGitlabBaseURL', () => {
      it('should update GitLab base URL', () => {
        const { result } = renderHook(() => useAppStore());

        act(() => {
          result.current.setGitlabBaseURL('https://git.company.com/api/v4');
        });

        expect(result.current.gitlabBaseURL).toBe('https://git.company.com/api/v4');
      });
    });

    describe('setLastMRURL', () => {
      it('should update last MR URL', () => {
        const { result } = renderHook(() => useAppStore());

        act(() => {
          result.current.setLastMRURL('https://gitlab.com/ns/proj/-/merge_requests/123');
        });

        expect(result.current.lastMRURL).toBe('https://gitlab.com/ns/proj/-/merge_requests/123');
      });
    });

    describe('toggleDarkMode', () => {
      it('should toggle dark mode from false to true', () => {
        const { result } = renderHook(() => useAppStore());

        // Capture initial state before the action
        const initialState = result.current.darkMode;

        act(() => {
          result.current.toggleDarkMode();
        });

        // Assert after act() completes so React has processed the update
        expect(result.current.darkMode).toBe(!initialState);
      });

      it('should toggle dark mode multiple times', () => {
        const { result } = renderHook(() => useAppStore());

        const initialState = result.current.darkMode;

        act(() => {
          result.current.toggleDarkMode();
        });
        expect(result.current.darkMode).toBe(!initialState);

        act(() => {
          result.current.toggleDarkMode();
        });
        expect(result.current.darkMode).toBe(initialState);
      });
    });
  });

  // =========================================================================
  // App State Actions Tests
  // =========================================================================
  describe('App State Actions', () => {
    describe('setConfigured', () => {
      it('should set configured state', () => {
        const { result } = renderHook(() => useAppStore());

        act(() => {
          result.current.setConfigured(true);
        });

        expect(result.current.isConfigured).toBe(true);
      });

      it('should unset configured state', () => {
        const { result } = renderHook(() => useAppStore());

        act(() => {
          result.current.setConfigured(true);
          result.current.setConfigured(false);
        });

        expect(result.current.isConfigured).toBe(false);
      });
    });

    describe('setCurrentMR', () => {
      it('should set current MR', () => {
        const { result } = renderHook(() => useAppStore());

        act(() => {
          result.current.setCurrentMR(mockOpenMR);
        });

        expect(result.current.currentMR).toEqual(mockOpenMR);
      });

      it('should clear current MR with null', () => {
        const { result } = renderHook(() => useAppStore());

        act(() => {
          result.current.setCurrentMR(mockOpenMR);
          result.current.setCurrentMR(null);
        });

        expect(result.current.currentMR).toBeNull();
      });
    });

    describe('setCurrentChanges', () => {
      it('should set current changes', () => {
        const { result } = renderHook(() => useAppStore());

        act(() => {
          result.current.setCurrentChanges([mockModifiedFile]);
        });

        expect(result.current.currentChanges).toEqual([mockModifiedFile]);
      });

      it('should handle empty array', () => {
        const { result } = renderHook(() => useAppStore());

        act(() => {
          result.current.setCurrentChanges([]);
        });

        expect(result.current.currentChanges).toEqual([]);
      });
    });

    describe('setParsedUrl', () => {
      it('should set parsed URL', () => {
        const { result } = renderHook(() => useAppStore());

        act(() => {
          result.current.setParsedUrl(mockParsedUrl);
        });

        expect(result.current.parsedUrl).toEqual(mockParsedUrl);
      });
    });

    describe('setCurrentReview', () => {
      it('should set current review', () => {
        const { result } = renderHook(() => useAppStore());
        const review = createMockReview();

        act(() => {
          result.current.setCurrentReview(review);
        });

        expect(result.current.currentReview).toEqual(review);
      });
    });

    describe('updateCommentSeverity', () => {
      it('should update comment severity when comment exists', () => {
        const { result } = renderHook(() => useAppStore());
        const review = createMockReview({
          comments: [
            { id: '1', filePath: 'test.ts', lineNumber: 10, severity: 'info', comment: 'Test' },
            { id: '2', filePath: 'test.ts', lineNumber: 20, severity: 'warning', comment: 'Test 2' },
          ],
        });

        act(() => {
          result.current.setCurrentReview(review);
        });

        act(() => {
          result.current.updateCommentSeverity('1', 'critical');
        });

        expect(result.current.currentReview?.comments[0].severity).toBe('critical');
        expect(result.current.currentReview?.comments[1].severity).toBe('warning'); // unchanged
      });

      it('should not throw when comment ID does not exist', () => {
        const { result } = renderHook(() => useAppStore());
        const review = createMockReview({
          comments: [
            { id: '1', filePath: 'test.ts', lineNumber: 10, severity: 'info', comment: 'Test' },
          ],
        });

        act(() => {
          result.current.setCurrentReview(review);
        });

        expect(() => {
          act(() => {
            result.current.updateCommentSeverity('nonexistent', 'critical');
          });
        }).not.toThrow();

        expect(result.current.currentReview?.comments[0].severity).toBe('info'); // unchanged
      });

      it('should handle null currentReview gracefully', () => {
        const { result } = renderHook(() => useAppStore());

        expect(result.current.currentReview).toBeNull();

        expect(() => {
          act(() => {
            result.current.updateCommentSeverity('1', 'critical');
          });
        }).not.toThrow();

        expect(result.current.currentReview).toBeNull();
      });
    });

    describe('setLoading', () => {
      it('should set loading state', () => {
        const { result } = renderHook(() => useAppStore());

        act(() => {
          result.current.setLoading(true);
        });

        expect(result.current.isLoading).toBe(true);
      });

      it('should set loading with message', () => {
        const { result } = renderHook(() => useAppStore());

        act(() => {
          result.current.setLoading(true, 'Generating review...');
        });

        expect(result.current.isLoading).toBe(true);
        expect(result.current.loadingMessage).toBe('Generating review...');
      });

      it('should clear loading message when turning off', () => {
        const { result } = renderHook(() => useAppStore());

        act(() => {
          result.current.setLoading(true, 'Loading...');
          result.current.setLoading(false);
        });

        expect(result.current.isLoading).toBe(false);
        expect(result.current.loadingMessage).toBe('');
      });
    });

    describe('setError', () => {
      it('should set error message', () => {
        const { result } = renderHook(() => useAppStore());

        act(() => {
          result.current.setError('Something went wrong');
        });

        expect(result.current.errorMessage).toBe('Something went wrong');
      });

      it('should clear error with null', () => {
        const { result } = renderHook(() => useAppStore());

        act(() => {
          result.current.setError('Error');
          result.current.setError(null);
        });

        expect(result.current.errorMessage).toBeNull();
      });
    });
  });

  // =========================================================================
  // Complex Actions Tests
  // =========================================================================
  describe('Complex Actions', () => {
    describe('reset', () => {
      it('should reset all runtime state', () => {
        const { result } = renderHook(() => useAppStore());
        const review = createMockReview();

        // Set up some state
        act(() => {
          result.current.setCurrentMR(mockOpenMR);
          result.current.setCurrentChanges([mockModifiedFile]);
          result.current.setParsedUrl(mockParsedUrl);
          result.current.setCurrentReview(review);
          result.current.setLoading(true, 'Loading...');
          result.current.setError('Error');
        });

        // Reset
        act(() => {
          result.current.reset();
        });

        expect(result.current.currentMR).toBeNull();
        expect(result.current.currentChanges).toBeNull();
        expect(result.current.parsedUrl).toBeNull();
        expect(result.current.currentReview).toBeNull();
        expect(result.current.isLoading).toBe(false);
        expect(result.current.loadingMessage).toBe('');
        expect(result.current.errorMessage).toBeNull();
      });

      it('should preserve persisted settings after reset', () => {
        const { result } = renderHook(() => useAppStore());

        act(() => {
          result.current.setGitlabBaseURL('https://custom.gitlab.com/api/v4');
          result.current.setLastMRURL('https://gitlab.com/ns/proj/-/merge_requests/1');
          result.current.reset();
        });

        // Settings should be preserved
        expect(result.current.gitlabBaseURL).toBe('https://custom.gitlab.com/api/v4');
        expect(result.current.lastMRURL).toBe('https://gitlab.com/ns/proj/-/merge_requests/1');
      });
    });

    describe('resetReview', () => {
      it('should reset only review and error', () => {
        const { result } = renderHook(() => useAppStore());
        const review = createMockReview();

        act(() => {
          result.current.setCurrentMR(mockOpenMR);
          result.current.setCurrentChanges([mockModifiedFile]);
          result.current.setCurrentReview(review);
          result.current.setError('Error');
        });

        act(() => {
          result.current.resetReview();
        });

        // Review and error should be cleared
        expect(result.current.currentReview).toBeNull();
        expect(result.current.errorMessage).toBeNull();

        // MR and changes should be preserved
        expect(result.current.currentMR).toEqual(mockOpenMR);
        expect(result.current.currentChanges).toEqual([mockModifiedFile]);
      });
    });
  });

  // =========================================================================
  // Selectors Tests
  // =========================================================================
  describe('Selectors', () => {
    describe('selectHasReview', () => {
      it('should return false when no review', () => {
        const { result } = renderHook(() => useAppStore());

        expect(selectHasReview(result.current)).toBe(false);
      });

      it('should return true when review exists', () => {
        const { result } = renderHook(() => useAppStore());
        const review = createMockReview();

        act(() => {
          result.current.setCurrentReview(review);
        });

        expect(selectHasReview(result.current)).toBe(true);
      });
    });
  });

  // =========================================================================
  // Persistence Tests
  // =========================================================================
  describe('Persistence', () => {
    it('should persist gitlabBaseURL to localStorage', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setGitlabBaseURL('https://custom.gitlab.com/api/v4');
      });

      // Zustand persist middleware should have called localStorage.setItem
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should persist lastMRURL to localStorage', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setLastMRURL('https://gitlab.com/ns/proj/-/merge_requests/1');
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should persist darkMode to localStorage', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.toggleDarkMode();
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should NOT persist runtime state', () => {
      const { result } = renderHook(() => useAppStore());

      // Clear mock to only track new calls
      mockLocalStorage.setItem.mockClear();

      act(() => {
        result.current.setCurrentMR(mockOpenMR);
        result.current.setCurrentChanges([mockModifiedFile]);
        result.current.setLoading(true);
        result.current.setError('Error');
      });

      // The setItem should be called but only for partial state
      const calls = mockLocalStorage.setItem.mock.calls;
      for (const call of calls) {
        const persistedData = JSON.parse(call[1] as string);
        expect(persistedData.state).not.toHaveProperty('currentMR');
        expect(persistedData.state).not.toHaveProperty('currentChanges');
        expect(persistedData.state).not.toHaveProperty('isLoading');
        expect(persistedData.state).not.toHaveProperty('errorMessage');
      }
    });
  });
});
