import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { LogPanel } from '../LogPanel';
import { useLogStore } from '../../store/logStore';
import type { LogEntry } from '@shared/types';

// Helper to create mock log entries
const createMockLog = (overrides: Partial<LogEntry> = {}): LogEntry => ({
  id: `log-${Math.random().toString(36).substr(2, 9)}`,
  timestamp: '2024-01-15T10:30:00.000Z',
  level: 'info',
  source: 'app',
  message: 'Test message',
  ...overrides,
});

describe('LogPanel', () => {
  beforeEach(() => {
    // Reset store state before each test
    const store = useLogStore.getState();
    store.clearLogs();
    store.setExpanded(false);
    store.setPanelHeight(200);
    store.setFilterLevel('all');
    store.setFilterSource('all');
  });

  // =========================================================================
  // Rendering Tests
  // =========================================================================
  describe('Rendering', () => {
    it('should render the collapsed header', () => {
      render(<LogPanel />);
      expect(screen.getByText('Logs')).toBeInTheDocument();
    });

    it('should show entry count in header', () => {
      const store = useLogStore.getState();
      act(() => {
        store.addLog(createMockLog());
        store.addLog(createMockLog());
      });

      render(<LogPanel />);
      expect(screen.getByText('2 entries')).toBeInTheDocument();
    });

    it('should show error count badge when there are errors', () => {
      const store = useLogStore.getState();
      act(() => {
        store.addLog(createMockLog({ level: 'error' }));
        store.addLog(createMockLog({ level: 'error' }));
      });

      render(<LogPanel />);
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('should show warning count badge when there are warnings', () => {
      const store = useLogStore.getState();
      act(() => {
        store.addLog(createMockLog({ level: 'warn' }));
      });

      render(<LogPanel />);
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('should not show expanded content when collapsed', () => {
      render(<LogPanel />);
      expect(screen.queryByText('All levels')).not.toBeInTheDocument();
      expect(screen.queryByText('Clear')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // Expand/Collapse Tests
  // =========================================================================
  describe('Expand/Collapse', () => {
    it('should expand when header is clicked', () => {
      render(<LogPanel />);

      const header = screen.getByText('Logs').closest('div');
      fireEvent.click(header!);

      expect(screen.getByText('All levels')).toBeInTheDocument();
      expect(screen.getByText('Clear')).toBeInTheDocument();
    });

    it('should collapse when header is clicked while expanded', () => {
      const store = useLogStore.getState();
      act(() => {
        store.setExpanded(true);
      });

      render(<LogPanel />);
      expect(screen.getByText('Clear')).toBeInTheDocument();

      const header = screen.getByText('Logs').closest('div');
      fireEvent.click(header!);

      expect(screen.queryByText('Clear')).not.toBeInTheDocument();
    });

    it('should show "No logs to display" when expanded with no logs', () => {
      const store = useLogStore.getState();
      act(() => {
        store.setExpanded(true);
      });

      render(<LogPanel />);
      expect(screen.getByText('No logs to display')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Log Display Tests
  // =========================================================================
  describe('Log Display', () => {
    it('should display log entries when expanded', () => {
      const store = useLogStore.getState();
      act(() => {
        store.addLog(createMockLog({ message: 'First log message' }));
        store.addLog(createMockLog({ message: 'Second log message' }));
        store.setExpanded(true);
      });

      render(<LogPanel />);
      expect(screen.getByText('First log message')).toBeInTheDocument();
      expect(screen.getByText('Second log message')).toBeInTheDocument();
    });

    it('should display formatted timestamp', () => {
      const store = useLogStore.getState();
      const timestamp = '2024-01-15T10:30:45.000Z';
      act(() => {
        store.addLog(createMockLog({ timestamp }));
        store.setExpanded(true);
      });

      render(<LogPanel />);
      // Time format: HH:mm:ss - the exact time depends on timezone
      // Just verify there's a timestamp in HH:mm:ss format
      expect(screen.getByText(/\d{2}:\d{2}:\d{2}/)).toBeInTheDocument();
    });

    it('should display source badge', () => {
      const store = useLogStore.getState();
      act(() => {
        store.addLog(createMockLog({ source: 'gitlab' }));
        store.setExpanded(true);
      });

      render(<LogPanel />);
      // Find the badge element specifically (uppercase, in a span with badge styling)
      const badges = screen.getAllByText('gitlab');
      // Should have at least the badge (dropdown option may also have it)
      expect(badges.length).toBeGreaterThan(0);
      // The badge should be in the log entry area
      const badge = badges.find(el => el.classList.contains('uppercase'));
      expect(badge).toBeInTheDocument();
    });

    it('should display log data when present', () => {
      const store = useLogStore.getState();
      act(() => {
        store.addLog(createMockLog({
          message: 'Test with data',
          data: { key: 'value', count: 42 },
        }));
        store.setExpanded(true);
      });

      render(<LogPanel />);
      expect(screen.getByText(/{"key":"value","count":42}/)).toBeInTheDocument();
    });

    it('should not display data section when data is absent', () => {
      const store = useLogStore.getState();
      act(() => {
        store.addLog(createMockLog({ data: undefined }));
        store.setExpanded(true);
      });

      render(<LogPanel />);
      // Should only have the message, no data section
      expect(screen.queryByText(/^\{/)).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // Filter Tests
  // =========================================================================
  describe('Filters', () => {
    it('should have level filter dropdown', () => {
      const store = useLogStore.getState();
      act(() => {
        store.setExpanded(true);
      });

      render(<LogPanel />);
      const levelSelect = screen.getByDisplayValue('All levels');
      expect(levelSelect).toBeInTheDocument();
    });

    it('should have source filter dropdown', () => {
      const store = useLogStore.getState();
      act(() => {
        store.setExpanded(true);
      });

      render(<LogPanel />);
      const sourceSelect = screen.getByDisplayValue('All sources');
      expect(sourceSelect).toBeInTheDocument();
    });

    it('should filter logs by level', () => {
      const store = useLogStore.getState();
      act(() => {
        store.addLog(createMockLog({ level: 'info', message: 'Info message' }));
        store.addLog(createMockLog({ level: 'error', message: 'Error message' }));
        store.setExpanded(true);
      });

      render(<LogPanel />);

      // Both should be visible initially
      expect(screen.getByText('Info message')).toBeInTheDocument();
      expect(screen.getByText('Error message')).toBeInTheDocument();

      // Filter to only errors
      const levelSelect = screen.getByDisplayValue('All levels');
      fireEvent.change(levelSelect, { target: { value: 'error' } });

      expect(screen.queryByText('Info message')).not.toBeInTheDocument();
      expect(screen.getByText('Error message')).toBeInTheDocument();
    });

    it('should filter logs by source', () => {
      const store = useLogStore.getState();
      act(() => {
        store.addLog(createMockLog({ source: 'app', message: 'App message' }));
        store.addLog(createMockLog({ source: 'gitlab', message: 'GitLab message' }));
        store.setExpanded(true);
      });

      render(<LogPanel />);

      // Both should be visible initially
      expect(screen.getByText('App message')).toBeInTheDocument();
      expect(screen.getByText('GitLab message')).toBeInTheDocument();

      // Filter to only gitlab
      const sourceSelect = screen.getByDisplayValue('All sources');
      fireEvent.change(sourceSelect, { target: { value: 'gitlab' } });

      expect(screen.queryByText('App message')).not.toBeInTheDocument();
      expect(screen.getByText('GitLab message')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Clear Logs Tests
  // =========================================================================
  describe('Clear Logs', () => {
    it('should clear logs when clear button is clicked', () => {
      const store = useLogStore.getState();
      act(() => {
        store.addLog(createMockLog({ message: 'Log to clear' }));
        store.setExpanded(true);
      });

      render(<LogPanel />);
      expect(screen.getByText('Log to clear')).toBeInTheDocument();

      const clearButton = screen.getByText('Clear');
      fireEvent.click(clearButton);

      expect(screen.queryByText('Log to clear')).not.toBeInTheDocument();
      expect(screen.getByText('No logs to display')).toBeInTheDocument();
    });

    it('should reset entry count after clearing', () => {
      const store = useLogStore.getState();
      act(() => {
        store.addLog(createMockLog());
        store.addLog(createMockLog());
        store.setExpanded(true);
      });

      render(<LogPanel />);
      expect(screen.getByText('2 entries')).toBeInTheDocument();

      const clearButton = screen.getByText('Clear');
      fireEvent.click(clearButton);

      expect(screen.getByText('0 entries')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Different Log Levels Display Tests
  // =========================================================================
  describe('Log Level Styling', () => {
    it('should render debug logs', () => {
      const store = useLogStore.getState();
      act(() => {
        store.addLog(createMockLog({ level: 'debug', message: 'Debug message' }));
        store.setExpanded(true);
      });

      render(<LogPanel />);
      expect(screen.getByText('Debug message')).toBeInTheDocument();
    });

    it('should render info logs', () => {
      const store = useLogStore.getState();
      act(() => {
        store.addLog(createMockLog({ level: 'info', message: 'Info message' }));
        store.setExpanded(true);
      });

      render(<LogPanel />);
      expect(screen.getByText('Info message')).toBeInTheDocument();
    });

    it('should render warn logs', () => {
      const store = useLogStore.getState();
      act(() => {
        store.addLog(createMockLog({ level: 'warn', message: 'Warning message' }));
        store.setExpanded(true);
      });

      render(<LogPanel />);
      expect(screen.getByText('Warning message')).toBeInTheDocument();
    });

    it('should render error logs', () => {
      const store = useLogStore.getState();
      act(() => {
        store.addLog(createMockLog({ level: 'error', message: 'Error message' }));
        store.setExpanded(true);
      });

      render(<LogPanel />);
      expect(screen.getByText('Error message')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // All Source Types Tests
  // =========================================================================
  describe('Log Source Types', () => {
    const sources = ['app', 'ipc', 'gitlab', 'codex', 'repository', 'config'] as const;

    sources.forEach(source => {
      it(`should render ${source} source badge`, () => {
        const store = useLogStore.getState();
        act(() => {
          store.addLog(createMockLog({ source, message: `${source} message` }));
          store.setExpanded(true);
        });

        render(<LogPanel />);
        // Find all elements with the source text (badge + dropdown option)
        const elements = screen.getAllByText(source);
        expect(elements.length).toBeGreaterThan(0);
        // Verify at least one is the uppercase badge
        const badge = elements.find(el => el.classList.contains('uppercase'));
        expect(badge).toBeInTheDocument();
      });
    });
  });
});
