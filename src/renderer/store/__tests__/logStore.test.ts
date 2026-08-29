import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLogStore, selectFilteredLogs, selectLogCounts } from '../logStore';
import type { LogEntry } from '@shared/types';

// Helper to create mock log entries
const createMockLog = (overrides: Partial<LogEntry> = {}): LogEntry => ({
  id: `log-${Math.random().toString(36).substr(2, 9)}`,
  timestamp: new Date().toISOString(),
  level: 'info',
  source: 'app',
  message: 'Test message',
  ...overrides,
});

describe('logStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    const { result } = renderHook(() => useLogStore());
    act(() => {
      result.current.clearLogs();
      result.current.setExpanded(false);
      result.current.setPanelHeight(200);
      result.current.setFilterLevel('all');
      result.current.setFilterSource('all');
    });
  });

  // =========================================================================
  // Initial State Tests
  // =========================================================================
  describe('Initial State', () => {
    it('should have empty logs initially', () => {
      const { result } = renderHook(() => useLogStore());
      expect(result.current.logs).toEqual([]);
    });

    it('should be collapsed initially', () => {
      const { result } = renderHook(() => useLogStore());
      expect(result.current.isExpanded).toBe(false);
    });

    it('should have default panel height of 200', () => {
      const { result } = renderHook(() => useLogStore());
      expect(result.current.panelHeight).toBe(200);
    });

    it('should have "all" as default filter level', () => {
      const { result } = renderHook(() => useLogStore());
      expect(result.current.filterLevel).toBe('all');
    });

    it('should have "all" as default filter source', () => {
      const { result } = renderHook(() => useLogStore());
      expect(result.current.filterSource).toBe('all');
    });
  });

  // =========================================================================
  // Log Actions Tests
  // =========================================================================
  describe('Log Actions', () => {
    describe('addLog', () => {
      it('should add a log entry', () => {
        const { result } = renderHook(() => useLogStore());
        const mockLog = createMockLog();

        act(() => {
          result.current.addLog(mockLog);
        });

        expect(result.current.logs).toHaveLength(1);
        expect(result.current.logs[0]).toEqual(mockLog);
      });

      it('should add multiple log entries', () => {
        const { result } = renderHook(() => useLogStore());
        const log1 = createMockLog({ message: 'First' });
        const log2 = createMockLog({ message: 'Second' });

        act(() => {
          result.current.addLog(log1);
          result.current.addLog(log2);
        });

        expect(result.current.logs).toHaveLength(2);
        expect(result.current.logs[0].message).toBe('First');
        expect(result.current.logs[1].message).toBe('Second');
      });

      it('should limit logs to MAX_LOGS (500)', () => {
        const { result } = renderHook(() => useLogStore());

        act(() => {
          // Add 510 logs
          for (let i = 0; i < 510; i++) {
            result.current.addLog(createMockLog({ message: `Log ${i}` }));
          }
        });

        expect(result.current.logs).toHaveLength(500);
        // Oldest logs should be removed, newest kept
        expect(result.current.logs[0].message).toBe('Log 10');
        expect(result.current.logs[499].message).toBe('Log 509');
      });
    });

    describe('clearLogs', () => {
      it('should clear all logs', () => {
        const { result } = renderHook(() => useLogStore());

        act(() => {
          result.current.addLog(createMockLog());
          result.current.addLog(createMockLog());
          result.current.clearLogs();
        });

        expect(result.current.logs).toEqual([]);
      });
    });

    describe('resetLogState', () => {
      it('should reset all state to initial values', () => {
        const { result } = renderHook(() => useLogStore());

        // Modify all state values
        act(() => {
          result.current.addLog(createMockLog());
          result.current.addLog(createMockLog());
          result.current.setExpanded(true);
          result.current.setPanelHeight(400);
          result.current.setFilterLevel('error');
          result.current.setFilterSource('gitlab');
        });

        // Verify state was modified
        expect(result.current.logs).toHaveLength(2);
        expect(result.current.isExpanded).toBe(true);
        expect(result.current.panelHeight).toBe(400);
        expect(result.current.filterLevel).toBe('error');
        expect(result.current.filterSource).toBe('gitlab');

        // Reset
        act(() => {
          result.current.resetLogState();
        });

        // Verify all state reset to initial values
        expect(result.current.logs).toEqual([]);
        expect(result.current.isExpanded).toBe(false);
        expect(result.current.panelHeight).toBe(200);
        expect(result.current.filterLevel).toBe('all');
        expect(result.current.filterSource).toBe('all');
      });

      it('should work when state is already at initial values', () => {
        const { result } = renderHook(() => useLogStore());

        act(() => {
          result.current.resetLogState();
        });

        expect(result.current.logs).toEqual([]);
        expect(result.current.isExpanded).toBe(false);
      });
    });
  });

  // =========================================================================
  // UI State Actions Tests
  // =========================================================================
  describe('UI State Actions', () => {
    describe('toggleExpanded', () => {
      it('should toggle expanded state from false to true', () => {
        const { result } = renderHook(() => useLogStore());

        act(() => {
          result.current.toggleExpanded();
        });

        expect(result.current.isExpanded).toBe(true);
      });

      it('should toggle expanded state from true to false', () => {
        const { result } = renderHook(() => useLogStore());

        act(() => {
          result.current.setExpanded(true);
          result.current.toggleExpanded();
        });

        expect(result.current.isExpanded).toBe(false);
      });
    });

    describe('setExpanded', () => {
      it('should set expanded to true', () => {
        const { result } = renderHook(() => useLogStore());

        act(() => {
          result.current.setExpanded(true);
        });

        expect(result.current.isExpanded).toBe(true);
      });

      it('should set expanded to false', () => {
        const { result } = renderHook(() => useLogStore());

        act(() => {
          result.current.setExpanded(true);
          result.current.setExpanded(false);
        });

        expect(result.current.isExpanded).toBe(false);
      });
    });

    describe('setPanelHeight', () => {
      it('should set panel height within bounds', () => {
        const { result } = renderHook(() => useLogStore());

        act(() => {
          result.current.setPanelHeight(300);
        });

        expect(result.current.panelHeight).toBe(300);
      });

      it('should clamp height to minimum of 100', () => {
        const { result } = renderHook(() => useLogStore());

        act(() => {
          result.current.setPanelHeight(50);
        });

        expect(result.current.panelHeight).toBe(100);
      });

      it('should clamp height to maximum of 500', () => {
        const { result } = renderHook(() => useLogStore());

        act(() => {
          result.current.setPanelHeight(600);
        });

        expect(result.current.panelHeight).toBe(500);
      });
    });
  });

  // =========================================================================
  // Filter Actions Tests
  // =========================================================================
  describe('Filter Actions', () => {
    describe('setFilterLevel', () => {
      it('should set filter level to specific level', () => {
        const { result } = renderHook(() => useLogStore());

        act(() => {
          result.current.setFilterLevel('error');
        });

        expect(result.current.filterLevel).toBe('error');
      });

      it('should set filter level to all', () => {
        const { result } = renderHook(() => useLogStore());

        act(() => {
          result.current.setFilterLevel('error');
          result.current.setFilterLevel('all');
        });

        expect(result.current.filterLevel).toBe('all');
      });
    });

    describe('setFilterSource', () => {
      it('should set filter source to specific source', () => {
        const { result } = renderHook(() => useLogStore());

        act(() => {
          result.current.setFilterSource('gitlab');
        });

        expect(result.current.filterSource).toBe('gitlab');
      });

      it('should set filter source to all', () => {
        const { result } = renderHook(() => useLogStore());

        act(() => {
          result.current.setFilterSource('gitlab');
          result.current.setFilterSource('all');
        });

        expect(result.current.filterSource).toBe('all');
      });
    });
  });

  // =========================================================================
  // Selectors Tests
  // =========================================================================
  describe('Selectors', () => {
    describe('selectFilteredLogs', () => {
      it('should return all logs when no filters applied', () => {
        const { result } = renderHook(() => useLogStore());
        const log1 = createMockLog({ level: 'info', source: 'app' });
        const log2 = createMockLog({ level: 'error', source: 'gitlab' });

        act(() => {
          result.current.addLog(log1);
          result.current.addLog(log2);
        });

        const filtered = selectFilteredLogs(result.current);
        expect(filtered).toHaveLength(2);
      });

      it('should filter by level', () => {
        const { result } = renderHook(() => useLogStore());
        const infoLog = createMockLog({ level: 'info' });
        const errorLog = createMockLog({ level: 'error' });

        act(() => {
          result.current.addLog(infoLog);
          result.current.addLog(errorLog);
          result.current.setFilterLevel('error');
        });

        const filtered = selectFilteredLogs(result.current);
        expect(filtered).toHaveLength(1);
        expect(filtered[0].level).toBe('error');
      });

      it('should filter by source', () => {
        const { result } = renderHook(() => useLogStore());
        const appLog = createMockLog({ source: 'app' });
        const gitlabLog = createMockLog({ source: 'gitlab' });

        act(() => {
          result.current.addLog(appLog);
          result.current.addLog(gitlabLog);
          result.current.setFilterSource('gitlab');
        });

        const filtered = selectFilteredLogs(result.current);
        expect(filtered).toHaveLength(1);
        expect(filtered[0].source).toBe('gitlab');
      });

      it('should filter by both level and source', () => {
        const { result } = renderHook(() => useLogStore());
        const logs = [
          createMockLog({ level: 'error', source: 'gitlab' }),
          createMockLog({ level: 'error', source: 'app' }),
          createMockLog({ level: 'info', source: 'gitlab' }),
          createMockLog({ level: 'info', source: 'app' }),
        ];

        act(() => {
          logs.forEach(log => result.current.addLog(log));
          result.current.setFilterLevel('error');
          result.current.setFilterSource('gitlab');
        });

        const filtered = selectFilteredLogs(result.current);
        expect(filtered).toHaveLength(1);
        expect(filtered[0].level).toBe('error');
        expect(filtered[0].source).toBe('gitlab');
      });

      it('should return empty array when no matches', () => {
        const { result } = renderHook(() => useLogStore());
        const infoLog = createMockLog({ level: 'info' });

        act(() => {
          result.current.addLog(infoLog);
          result.current.setFilterLevel('error');
        });

        const filtered = selectFilteredLogs(result.current);
        expect(filtered).toHaveLength(0);
      });
    });

    describe('selectLogCounts', () => {
      it('should return zero counts for empty logs', () => {
        const { result } = renderHook(() => useLogStore());

        const counts = selectLogCounts(result.current);
        expect(counts.total).toBe(0);
        expect(counts.errors).toBe(0);
        expect(counts.warnings).toBe(0);
      });

      it('should count total logs correctly', () => {
        const { result } = renderHook(() => useLogStore());

        act(() => {
          result.current.addLog(createMockLog());
          result.current.addLog(createMockLog());
          result.current.addLog(createMockLog());
        });

        const counts = selectLogCounts(result.current);
        expect(counts.total).toBe(3);
      });

      it('should count error logs correctly', () => {
        const { result } = renderHook(() => useLogStore());

        act(() => {
          result.current.addLog(createMockLog({ level: 'error' }));
          result.current.addLog(createMockLog({ level: 'error' }));
          result.current.addLog(createMockLog({ level: 'info' }));
        });

        const counts = selectLogCounts(result.current);
        expect(counts.errors).toBe(2);
      });

      it('should count warning logs correctly', () => {
        const { result } = renderHook(() => useLogStore());

        act(() => {
          result.current.addLog(createMockLog({ level: 'warn' }));
          result.current.addLog(createMockLog({ level: 'info' }));
          result.current.addLog(createMockLog({ level: 'warn' }));
        });

        const counts = selectLogCounts(result.current);
        expect(counts.warnings).toBe(2);
      });

      it('should count mixed log levels correctly', () => {
        const { result } = renderHook(() => useLogStore());

        act(() => {
          result.current.addLog(createMockLog({ level: 'debug' }));
          result.current.addLog(createMockLog({ level: 'info' }));
          result.current.addLog(createMockLog({ level: 'warn' }));
          result.current.addLog(createMockLog({ level: 'warn' }));
          result.current.addLog(createMockLog({ level: 'error' }));
          result.current.addLog(createMockLog({ level: 'error' }));
          result.current.addLog(createMockLog({ level: 'error' }));
        });

        const counts = selectLogCounts(result.current);
        expect(counts.total).toBe(7);
        expect(counts.errors).toBe(3);
        expect(counts.warnings).toBe(2);
      });
    });
  });
});
