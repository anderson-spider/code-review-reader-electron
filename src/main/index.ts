import { app, BrowserWindow, shell } from 'electron';
import * as path from 'path';
import { registerIpcHandlers } from './ipc/handlers';
import { logger } from './services/logger.service';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// electron-squirrel-startup is only needed for Windows NSIS installers
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  if (require('electron-squirrel-startup')) {
    app.quit();
  }
} catch {
  // Module not available, continue normally
}

let mainWindow: BrowserWindow | null = null;

const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

function createWindow(): void {
  // In compiled output, preload.js is in the same directory as index.js
  const preloadPath = path.join(__dirname, 'preload.js');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Code Review Reader',
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Required for keytar to work
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 15, y: 10 },
  });

  // Set main window reference for logger
  logger.setMainWindow(mainWindow);

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    // In development, load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files (dist/main/main -> dist/renderer)
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Register IPC handlers
registerIpcHandlers();

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();
  logger.info('app', 'Application started', { version: app.getVersion() });

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Prevent new windows from being created
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    // Only allow navigation to the app itself in dev mode
    if (isDev && parsedUrl.origin === 'http://localhost:5173') {
      return;
    }
    event.preventDefault();
  });
});
