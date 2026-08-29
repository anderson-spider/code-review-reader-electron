import { BrowserWindow } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { IPC_CHANNELS, LogEntry, LogLevel, LogSource } from '../../shared/types';

/**
 * Centralized logger service that emits logs to both console and renderer via IPC.
 * Singleton pattern to allow easy access from any service.
 */
class LoggerService {
  private mainWindow: BrowserWindow | null = null;

  /**
   * Set the main window reference for IPC communication.
   * Must be called after window creation.
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Create a log entry and send it to renderer.
   */
  private log(level: LogLevel, source: LogSource, message: string, data?: Record<string, unknown>): void {
    const entry: LogEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      level,
      source,
      message,
      data,
    };

    // Console output with colored prefix
    const prefix = `[${source.toUpperCase()}]`;
    const consoleMethod = level === 'error' ? console.error
      : level === 'warn' ? console.warn
      : level === 'debug' ? console.debug
      : console.log;

    if (data) {
      consoleMethod(prefix, message, data);
    } else {
      consoleMethod(prefix, message);
    }

    // Send to renderer via IPC
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(IPC_CHANNELS.LOG_ENTRY, entry);
    }
  }

  debug(source: LogSource, message: string, data?: Record<string, unknown>): void {
    this.log('debug', source, message, data);
  }

  info(source: LogSource, message: string, data?: Record<string, unknown>): void {
    this.log('info', source, message, data);
  }

  warn(source: LogSource, message: string, data?: Record<string, unknown>): void {
    this.log('warn', source, message, data);
  }

  error(source: LogSource, message: string, data?: Record<string, unknown>): void {
    this.log('error', source, message, data);
  }
}

// Export singleton instance
export const logger = new LoggerService();
