import { create } from 'zustand';
import type { LogEntry, LogLevel, LogSource } from '@shared/types';

const MAX_LOGS = 500;

interface LogState {
  logs: LogEntry[];
  isExpanded: boolean;
  panelHeight: number;
  filterLevel: LogLevel | 'all';
  filterSource: LogSource | 'all';
}

interface LogActions {
  addLog: (entry: LogEntry) => void;
  clearLogs: () => void;
  resetLogState: () => void;
  toggleExpanded: () => void;
  setExpanded: (expanded: boolean) => void;
  setPanelHeight: (height: number) => void;
  setFilterLevel: (level: LogLevel | 'all') => void;
  setFilterSource: (source: LogSource | 'all') => void;
}

type LogStore = LogState & LogActions;

const initialState: LogState = {
  logs: [],
  isExpanded: false,
  panelHeight: 200,
  filterLevel: 'all',
  filterSource: 'all',
};

export const useLogStore = create<LogStore>((set) => ({
  ...initialState,

  addLog: (entry) =>
    set((state) => ({
      logs: [...state.logs, entry].slice(-MAX_LOGS),
    })),

  clearLogs: () => set({ logs: [] }),

  resetLogState: () => set(initialState),

  toggleExpanded: () =>
    set((state) => ({ isExpanded: !state.isExpanded })),

  setExpanded: (expanded) => set({ isExpanded: expanded }),

  setPanelHeight: (height) => set({ panelHeight: Math.max(100, Math.min(500, height)) }),

  setFilterLevel: (level) => set({ filterLevel: level }),

  setFilterSource: (source) => set({ filterSource: source }),
}));

// Selectors
export const selectFilteredLogs = (state: LogStore): LogEntry[] => {
  let filtered = state.logs;

  if (state.filterLevel !== 'all') {
    filtered = filtered.filter((log) => log.level === state.filterLevel);
  }

  if (state.filterSource !== 'all') {
    filtered = filtered.filter((log) => log.source === state.filterSource);
  }

  return filtered;
};

export const selectLogCounts = (state: LogStore) => ({
  total: state.logs.length,
  errors: state.logs.filter((log) => log.level === 'error').length,
  warnings: state.logs.filter((log) => log.level === 'warn').length,
});
