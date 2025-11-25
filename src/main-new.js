// This approach avoids requiring electron in the main entry point
// Instead, we'll use process.electronBinding or check if we're in Electron context

const path = require('path');
const Store = require('electron-store');
const log = require('electron-log');

// Load environment variables
require('dotenv').config();

const store = new Store();
let mainWindow;

// Get Electron APIs through process.electronBinding (internal API)
let app, BrowserWindow, ipcMain, shell;

try {
  // This is the correct way to access Electron APIs from within an Electron process
  const electronBinding = process.electronBinding;
  if (electronBinding) {
    // We're running in Electron context
    const electron = require('electron');
    if (typeof electron === 'object') {
      ({ app, BrowserWindow, ipcMain, shell } = electron);
    } else {
      // Fallback: use global electron objects that should be available
      app = global.require('electron').app;
      BrowserWindow = global.require('electron').BrowserWindow;
      ipcMain = global.require('electron').ipcMain;
      shell = global.require('electron').shell;
    }
  }
} catch (error) {
  console.error('Failed to load Electron APIs:', error);
  process.exit(1);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

// App event handlers
if (app && app.whenReady) {
  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
} else {
  console.error('Electron app API not available');
  process.exit(1);
}

// IPC Handlers - Import modules only when needed
if (ipcMain) {
  ipcMain.handle('connect-google', async () => {
    try {
      const { googleOAuth } = require('./oauth');
      const result = await googleOAuth(shell);
      return result;
    } catch (error) {
      log.error('Google OAuth error:', error);
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle('connect-notion', async () => {
    try {
      const { notionOAuth } = require('./oauth');
      const result = await notionOAuth(shell);
      return result;
    } catch (error) {
      log.error('Notion OAuth error:', error);
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle('list-google-calendars', async () => {
    try {
      const { listGoogleCalendars } = require('./google');
      return await listGoogleCalendars();
    } catch (error) {
      log.error('List calendars error:', error);
      return [];
    }
  });

  ipcMain.handle('list-notion-databases', async () => {
    try {
      const { listDatabases } = require('./notion');
      return await listDatabases();
    } catch (error) {
      log.error('List databases error:', error);
      return [];
    }
  });

  ipcMain.handle('get-google-user-info', async () => {
    try {
      const { getGoogleUserInfo } = require('./google');
      return await getGoogleUserInfo();
    } catch (error) {
      log.error('Get user info error:', error);
      return null;
    }
  });

  // Window controls
  ipcMain.handle('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.handle('window-maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.handle('window-close', () => {
    if (mainWindow) mainWindow.close();
  });
}

console.log('Synk app initialized successfully');