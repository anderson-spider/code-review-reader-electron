/* eslint-disable no-console */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserWindow } from 'electron';
import type { LogEntry, LogSource } from '../../../shared/types';

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'mock-uuid-123',
}));

// Mock BrowserWindow
const mockWebContents = {
  send: vi.fn(),
};

const mockBrowserWindow = {
  isDestroyed: vi.fn(() => false),
  webContents: mockWebContents,
} as unknown as BrowserWindow;

// Store original console methods
const originalConsole = {
  log: console.log,
  debug: console.debug,
  warn: console.warn,
  error: console.error,
};

describe('LoggerService', () => {
  // We need to import fresh module for each test to reset singleton
  let logger: typeof import('../logger.service').logger;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Mock console methods
    console.log = vi.fn();
    console.debug = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();

    // Reset module cache and reimport
    vi.resetModules();
    const module = await import('../logger.service');
    logger = module.logger;
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsole.log;
    console.debug = originalConsole.debug;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });

  describe('Console Output', () => {
    it('should log info to console.log', () => {
      logger.info('app', 'Test info message');

      expect(console.log).toHaveBeenCalledWith('[APP]', 'Test info message');
    });

    it('should log debug to console.debug', () => {
      logger.debug('gitlab', 'Test debug message');

      expect(console.debug).toHaveBeenCalledWith('[GITLAB]', 'Test debug message');
    });

    it('should log warn to console.warn', () => {
      logger.warn('codex', 'Test warning message');

      expect(console.warn).toHaveBeenCalledWith('[CODEX]', 'Test warning message');
    });

    it('should log error to console.error', () => {
      logger.error('ipc', 'Test error message');

      expect(console.error).toHaveBeenCalledWith('[IPC]', 'Test error message');
    });

    it('should include data in console output when provided', () => {
      const data = { key: 'value', count: 42 };
      logger.info('app', 'Message with data', data);

      expect(console.log).toHaveBeenCalledWith('[APP]', 'Message with data', data);
    });

    it('should uppercase the source in log prefix', () => {
      logger.info('repository', 'Test message');

      expect(console.log).toHaveBeenCalledWith('[REPOSITORY]', 'Test message');
    });
  });

  describe('IPC Communication', () => {
    it('should not send IPC when mainWindow is not set', () => {
      logger.info('app', 'Test message');

      // webContents.send should not be called
      expect(mockWebContents.send).not.toHaveBeenCalled();
    });

    it('should send log entry via IPC when mainWindow is set', () => {
      logger.setMainWindow(mockBrowserWindow);
      logger.info('app', 'Test message');

      expect(mockWebContents.send).toHaveBeenCalledWith(
        'log:entry',
        expect.objectContaining({
          id: 'mock-uuid-123',
          level: 'info',
          source: 'app',
          message: 'Test message',
        })
      );
    });

    it('should include timestamp in log entry', () => {
      logger.setMainWindow(mockBrowserWindow);
      logger.info('app', 'Test message');

      expect(mockWebContents.send).toHaveBeenCalledWith(
        'log:entry',
        expect.objectContaining({
          timestamp: expect.any(String),
        })
      );

      // Verify timestamp is valid ISO string
      const call = mockWebContents.send.mock.calls[0];
      const entry = call[1] as LogEntry;
      expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp);
    });

    it('should include data in log entry when provided', () => {
      logger.setMainWindow(mockBrowserWindow);
      const data = { error: 'test error', code: 500 };
      logger.error('gitlab', 'Error occurred', data);

      expect(mockWebContents.send).toHaveBeenCalledWith(
        'log:entry',
        expect.objectContaining({
          level: 'error',
          source: 'gitlab',
          message: 'Error occurred',
          data: { error: 'test error', code: 500 },
        })
      );
    });

    it('should not include data field when not provided', () => {
      logger.setMainWindow(mockBrowserWindow);
      logger.info('app', 'No data message');

      const call = mockWebContents.send.mock.calls[0];
      const entry = call[1] as LogEntry;
      expect(entry.data).toBeUndefined();
    });

    it('should not send IPC when window is destroyed', () => {
      const destroyedWindow = {
        isDestroyed: vi.fn(() => true),
        webContents: mockWebContents,
      } as unknown as BrowserWindow;

      logger.setMainWindow(destroyedWindow);
      mockWebContents.send.mockClear();
      logger.info('app', 'Test message');

      expect(mockWebContents.send).not.toHaveBeenCalled();
    });
  });

  describe('Log Levels', () => {
    beforeEach(() => {
      logger.setMainWindow(mockBrowserWindow);
    });

    it('should create debug level entry', () => {
      logger.debug('config', 'Debug message');

      expect(mockWebContents.send).toHaveBeenCalledWith(
        'log:entry',
        expect.objectContaining({ level: 'debug' })
      );
    });

    it('should create info level entry', () => {
      logger.info('config', 'Info message');

      expect(mockWebContents.send).toHaveBeenCalledWith(
        'log:entry',
        expect.objectContaining({ level: 'info' })
      );
    });

    it('should create warn level entry', () => {
      logger.warn('config', 'Warn message');

      expect(mockWebContents.send).toHaveBeenCalledWith(
        'log:entry',
        expect.objectContaining({ level: 'warn' })
      );
    });

    it('should create error level entry', () => {
      logger.error('config', 'Error message');

      expect(mockWebContents.send).toHaveBeenCalledWith(
        'log:entry',
        expect.objectContaining({ level: 'error' })
      );
    });
  });

  describe('Log Sources', () => {
    const sources: LogSource[] = ['app', 'ipc', 'gitlab', 'codex', 'repository', 'config'];

    beforeEach(() => {
      logger.setMainWindow(mockBrowserWindow);
    });

    sources.forEach((source) => {
      it(`should accept ${source} as valid source`, () => {
        logger.info(source, `Message from ${source}`);

        expect(mockWebContents.send).toHaveBeenCalledWith(
          'log:entry',
          expect.objectContaining({ source })
        );
      });
    });
  });

  describe('Singleton Pattern', () => {
    it('should export a singleton instance', async () => {
      // Import twice to verify same instance
      const module1 = await import('../logger.service');
      const module2 = await import('../logger.service');

      expect(module1.logger).toBe(module2.logger);
    });
  });
});
