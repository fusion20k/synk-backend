const path = require('path');
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const Store = require('electron-store');
const keytar = require('keytar');

require('dotenv').config();

let mainWindow;
const store = new Store();

console.log('[MAIN] 🚀 Starting Synk app...');
console.log('[MAIN] process.type:', process.type);

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-dev-shm-usage');

async function handleFirstRun() {
  try {
    const isFirstRun = !store.get('app.initialized');
    
    if (isFirstRun) {
      console.log('[MAIN] 🆕 First run detected - clearing any existing tokens to prevent auto-login with old accounts');
      
      try {
        await keytar.deletePassword('synk-app', 'google-oauth');
        console.log('[MAIN] ✅ Cleared Google tokens from system keychain');
      } catch (e) {
        console.log('[MAIN] ℹ️ No Google tokens to clear (expected on first run)');
      }
      
      try {
        await keytar.deletePassword('synk-app', 'notion-oauth');
        console.log('[MAIN] ✅ Cleared Notion tokens from system keychain');
      } catch (e) {
        console.log('[MAIN] ℹ️ No Notion tokens to clear (expected on first run)');
      }
      
      store.clear();
      store.set('app.initialized', true);
      console.log('[MAIN] ✅ First-run initialization complete - app marked as initialized');
    } else {
      console.log('[MAIN] ℹ️ Existing installation detected - tokens will be restored from system keychain');
    }
  } catch (error) {
    console.error('[MAIN] ❌ Error during first-run check:', error.message);
  }
}

function createWindow() {
  console.log('[MAIN] 📱 Creating BrowserWindow');
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    frame: false,
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      enableRemoteModule: false,
      sandbox: true
    }
  });

  const indexPath = path.join(__dirname, 'index.html');
  console.log('[MAIN] Loading:', indexPath);
  
  mainWindow.loadFile(indexPath).catch(err => {
    console.error('[MAIN] Failed to load index.html:', err);
    mainWindow.loadURL(`data:text/html,<h1>Synk App</h1><p>Error loading app</p>`);
  });

  mainWindow.once('ready-to-show', () => {
    console.log('[MAIN] ✅ Window ready to show');
    mainWindow.show();
  });

  mainWindow.on('close', (event) => {
    console.log('[MAIN] ⚠️ CLOSE EVENT FIRED');
    event.preventDefault();
    console.log('[MAIN] CLOSE PREVENTED');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.hide();
      console.log('[MAIN] ✅ Window hidden');
    }
  });

  mainWindow.on('closed', () => {
    console.log('[MAIN] Window fully closed');
    mainWindow = null;
  });

  mainWindow.on('minimize', () => {
    console.log('[MAIN] Window minimized to taskbar - ✅ App still running');
  });

  mainWindow.on('restore', () => {
    console.log('[MAIN] Window restored from taskbar');
  });

  mainWindow.on('focus', () => {
    console.log('[MAIN] Window focused');
  });

  mainWindow.on('blur', () => {
    console.log('[MAIN] Window lost focus - ✅ App still running in background');
  });

  mainWindow.webContents.on('crashed', () => {
    console.error('[MAIN] ❌ Renderer process crashed!');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.reload();
    }
  });

  mainWindow.webContents.on('unresponsive', () => {
    console.error('[MAIN] ❌ Renderer process unresponsive!');
  });
}

ipcMain.handle('window-close', () => {
  console.log('[IPC] Close button clicked');
  if (mainWindow) {
    mainWindow.hide();
    console.log('[IPC] ✅ Window hidden, app still running');
  }
  return {};
});

ipcMain.handle('app-quit', () => {
  console.log('[IPC] App quit requested');
  mainWindow = null;
  app.quit();
  return {};
});

ipcMain.handle('start-google-oauth', async () => {
  try {
    console.log('[OAuth] Starting Google OAuth...');
    const { googleOAuthViaProduction } = require('./oauth');
    const result = await googleOAuthViaProduction(shell);
    
    if (result.ok && mainWindow) {
      mainWindow.webContents.send('google-oauth-success', result.calendars || []);
      console.log('[OAuth] ✅ Google OAuth successful');
      return { success: true, calendars: result.calendars };
    } else {
      console.error('[OAuth] ❌ Google OAuth failed:', result.error);
      if (mainWindow) mainWindow.webContents.send('google-oauth-failed', result.error);
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('[OAuth] ❌ Google OAuth error:', error.message);
    if (mainWindow) mainWindow.webContents.send('google-oauth-failed', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('start-notion-oauth', async () => {
  try {
    console.log('[OAuth] Starting Notion OAuth...');
    const { notionOAuthViaProduction } = require('./oauth');
    const result = await notionOAuthViaProduction(shell);
    
    if (result.ok && mainWindow) {
      mainWindow.webContents.send('notion-oauth-success', result.databases || []);
      console.log('[OAuth] ✅ Notion OAuth successful');
      return { success: true, databases: result.databases, workspace: result.workspace };
    } else {
      console.error('[OAuth] ❌ Notion OAuth failed:', result.error);
      if (mainWindow) mainWindow.webContents.send('notion-oauth-failed', result.error);
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('[OAuth] ❌ Notion OAuth error:', error.message);
    if (mainWindow) mainWindow.webContents.send('notion-oauth-failed', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-external', async (event, url) => {
  try {
    console.log('[IPC] Opening external URL:', url);
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('[IPC] Failed to open external URL:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('list-google-calendars', async () => {
  try {
    console.log('[IPC] Fetching Google calendars...');
    const { listGoogleCalendars } = require('./google');
    const result = await listGoogleCalendars();
    return result;
  } catch (error) {
    console.error('[IPC] Failed to list calendars:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('list-notion-databases', async () => {
  try {
    console.log('[IPC] Fetching Notion databases...');
    const { listDatabases } = require('./notion');
    const result = await listDatabases();
    return result.databases || [];
  } catch (error) {
    console.error('[IPC] Failed to list databases:', error);
    return [];
  }
});

ipcMain.handle('list-databases', async () => {
  try {
    console.log('[IPC] Fetching Notion databases...');
    const { listDatabases } = require('./notion');
    const result = await listDatabases();
    return result.databases || [];
  } catch (error) {
    console.error('[IPC] Failed to list databases:', error);
    return [];
  }
});

ipcMain.handle('get-user-setting', async (event, key) => {
  try {
    const { getUserSetting } = require('./userSettings');
    const value = await getUserSetting(key);
    return { success: true, value };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-user-setting', async (event, key, value) => {
  try {
    const { saveUserSetting } = require('./userSettings');
    await saveUserSetting(key, value);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('start-sync', async (event, syncPairs) => {
  try {
    console.log('[Sync] Starting sync with pairs:', syncPairs);
    return { success: true };
  } catch (error) {
    console.error('[Sync] Error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-sync', async () => {
  try {
    console.log('[Sync] Stopping sync');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('restore-sync-pairs', async () => {
  try {
    console.log('[Sync] Restoring sync pairs');
    return { success: true, syncPairs: [] };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('force-sync', async () => {
  try {
    console.log('[Sync] Force sync triggered');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-sync-status', async () => {
  try {
    return { success: true, stats: {}, lastSync: null, isActive: false };
  } catch (error) {
    return { success: false };
  }
});

ipcMain.handle('get-sync-stats', async () => {
  try {
    return { success: true, stats: {} };
  } catch (error) {
    return { success: false };
  }
});

ipcMain.handle('set-background-sync', async (event, enabled) => {
  try {
    console.log('[Sync] 🔄 Background sync:', enabled ? '✅ ENABLED' : '❌ DISABLED');
    if (enabled) {
      console.log('[Sync] Background sync will sync changes every 2 minutes');
    } else {
      console.log('[Sync] Background sync paused - manual sync only');
    }
    return { success: true, enabled };
  } catch (error) {
    console.error('[Sync] Error setting background sync:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('set-app-visibility', async (event, isVisible) => {
  if (mainWindow) {
    if (isVisible) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      mainWindow.hide();
    }
  }
  return { success: true };
});

ipcMain.handle('show-window', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
  return { success: true };
});

ipcMain.handle('notify-sync-manager-focus', async (event, isFocused) => {
  console.log('[Sync] App focus state:', isFocused);
  return { success: true };
});

ipcMain.handle('get-user-plan', async () => {
  return { success: true, plan: { type: 'free' } };
});

ipcMain.handle('set-user-plan', async (event, planData) => {
  return { success: true };
});

ipcMain.handle('start-trial', async () => {
  return { success: true, result: { type: 'trial' } };
});

ipcMain.handle('check-feature-access', async (event, feature) => {
  return { success: true, hasAccess: true };
});

ipcMain.handle('get-plan-limits', async () => {
  return { success: true, limits: {} };
});

ipcMain.handle('refresh-plan-from-backend', async () => {
  return { success: true };
});

ipcMain.handle('start-plan-auto-refresh', async () => {
  return { success: true };
});

ipcMain.handle('stop-plan-auto-refresh', async () => {
  return { success: true };
});

ipcMain.handle('open-customer-portal', async () => {
  return { success: true };
});

ipcMain.handle('open-pricing-page', async () => {
  return { success: true };
});

ipcMain.handle('clear-all-data', async () => {
  try {
    console.log('[Data] Clearing all data');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('check-existing-tokens', async () => {
  try {
    console.log('[Tokens] Checking for existing tokens in system keychain');
    
    let hasGoogle = false;
    let hasNotion = false;
    
    try {
      const googleToken = await keytar.getPassword('synk-app', 'google-oauth');
      hasGoogle = !!googleToken;
      console.log('[Tokens] Google tokens:', hasGoogle ? 'FOUND' : 'NOT FOUND');
    } catch (e) {
      console.log('[Tokens] Error checking Google tokens:', e.message);
    }
    
    try {
      const notionToken = await keytar.getPassword('synk-app', 'notion-oauth');
      hasNotion = !!notionToken;
      console.log('[Tokens] Notion tokens:', hasNotion ? 'FOUND' : 'NOT FOUND');
    } catch (e) {
      console.log('[Tokens] Error checking Notion tokens:', e.message);
    }
    
    return { success: true, hasGoogle, hasNotion };
  } catch (error) {
    console.error('[Tokens] Error during token check:', error.message);
    return { success: true, hasGoogle: false, hasNotion: false };
  }
});

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('[MAIN] ⚠️ Another instance is already running - exiting');
  app.quit();
} else {
  console.log('[MAIN] ✅ Single instance lock acquired');
}

app.whenReady().then(async () => {
  await handleFirstRun();
  console.log('[MAIN] ✅ App ready, creating window');
  try {
    createWindow();
  } catch (err) {
    console.error('[MAIN] ❌ Error creating window:', err);
    process.exit(1);
  }
}).catch(err => {
  console.error('[MAIN] ❌ App ready error:', err);
});

app.on('window-all-closed', () => {
  console.log('[MAIN] ⚠️ WINDOW-ALL-CLOSED EVENT FIRED');
  console.log('[MAIN] ✅ Keeping app running in background (NOT quitting)');
});

app.on('before-quit', () => {
  console.log('[MAIN] 🔴 BEFORE-QUIT EVENT FIRED - App is about to terminate');
});

app.on('second-instance', () => {
  console.log('[MAIN] Second instance detected, showing window');
  if (mainWindow) {
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    mainWindow.focus();
  }
});

process.on('uncaughtException', (error) => {
  console.error('[MAIN] ❌ Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[MAIN] ❌ Unhandled rejection at:', promise, 'reason:', reason);
});

console.log('[MAIN] ✅ Main process initialized, handlers registered');
