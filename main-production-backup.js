// Production-only Electron main process
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

console.log('🚀 Starting Synk in Production Mode...');

// Import Electron with error handling
let app, BrowserWindow, ipcMain, shell, nativeImage;

try {
  const electron = require('electron');
  app = electron.app;
  BrowserWindow = electron.BrowserWindow;
  ipcMain = electron.ipcMain;
  shell = electron.shell;
  nativeImage = electron.nativeImage;
  console.log('✅ Electron APIs loaded successfully');
} catch (error) {
  console.error('❌ Failed to load Electron:', error.message);
  process.exit(1);
}

let mainWindow = null;

// Production mode - no local OAuth server needed
console.log('✅ Production mode - using remote OAuth endpoints only');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false, // remove native window frame
    titleBarStyle: 'hidden', // use custom titlebar in UI
    autoHideMenuBar: true, // hide menu bar in production
    backgroundColor: '#000000',
    // Use proper Windows .ico for taskbar/exe icon
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'src', 'preload.js'),
      additionalArguments: [
        `BACKEND_URL=${process.env.BACKEND_URL || ''}`
      ]
    },
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('✅ Window shown');
    // Auto-updater disabled for BETA build
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // In production, do not open DevTools automatically
  // mainWindow.webContents.openDevTools();
}

// Register IPC handlers function
function registerIpcHandlers() {
  console.log('🔧 Registering IPC handlers...');

  if (!ipcMain) {
    console.error('❌ ipcMain is undefined - Electron not loaded properly');
    return;
  }

  ipcMain.handle('start-google-oauth', async (event, options = {}) => {
    console.log('[OAuth] Google OAuth requested (Production mode)');
    
    try {
      const { googleOAuthViaProduction } = require('./src/oauth');
      console.log('[OAuth] Starting production Google OAuth...');
      
      const result = await googleOAuthViaProduction(shell);
      console.log('[OAuth] Google OAuth result:', result);
      
      if (result.ok) {
        console.log(`[OAuth] SUCCESS: ${result.calendars.allCalendars?.length || 0} calendars fetched`);
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('google-oauth-success', result.calendars);
        }
        return { 
          success: true, 
          calendars: result.calendars
        };
      } else {
        console.error('[OAuth] Google OAuth failed:', result.error);
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('google-oauth-failed', result.error || 'unknown');
        }
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('[OAuth] Google OAuth error:', error);
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('google-oauth-failed', error.message);
      }
      return { success: false, error: error.message };
    }
  });

  // Notion OAuth handler (production only)
  ipcMain.handle('start-notion-oauth', async (event, options = {}) => {
    console.log('[OAuth] Notion OAuth requested (Production mode)');
    
    try {
      const { notionOAuthViaProduction } = require('./src/oauth');
      console.log('[OAuth] Starting production Notion OAuth...');
      
      const result = await notionOAuthViaProduction(shell);
      console.log('[OAuth] Notion OAuth result:', result);
      
      if (result.ok) {
        console.log(`[OAuth] SUCCESS: Notion workspace connected with ${result.databases?.length || 0} databases`);
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('notion-oauth-success', {
            workspace: result.workspace,
            databases: result.databases
          });
        }
        return { 
          success: true, 
          workspace: result.workspace,
          databases: result.databases
        };
      } else {
        console.error('[OAuth] Notion OAuth failed:', result.error);
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('notion-oauth-failed', result.error || 'unknown');
        }
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('[OAuth] Notion OAuth error:', error);
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('notion-oauth-failed', error.message);
      }
      return { success: false, error: error.message };
    }
  });

  // Window control handlers
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

  ipcMain.handle('window-is-maximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false;
  });

  // External link handler
  ipcMain.handle('open-external', async (event, url) => {
    if (shell) {
      await shell.openExternal(url);
    }
  });

  // Calendar and database handlers
  ipcMain.handle('list-google-calendars', async () => {
    console.log('[Data] Fetching Google calendars...');
    try {
      const { listGoogleCalendars } = require('./src/google');
      const calendars = await listGoogleCalendars();
      return { success: true, calendars };
    } catch (error) {
      console.error('[Data] Failed to fetch calendars:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('list-databases', async () => {
    console.log('[Data] Fetching Notion databases...');
    try {
      const { listDatabases } = require('./src/notion');
      const result = await listDatabases();
      return { success: true, databases: result.databases };
    } catch (error) {
      console.error('[Data] Failed to fetch databases:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('list-notion-databases', async () => {
    console.log('[Data] Fetching Notion databases...');
    try {
      const { listDatabases } = require('./src/notion');
      const result = await listDatabases();
      return { success: true, databases: result.databases };
    } catch (error) {
      console.error('[Data] Failed to fetch databases:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-google-user-info', async () => {
    console.log('[Data] Fetching Google user info...');
    try {
      const { getGoogleUserInfo } = require('./src/google');
      const userInfo = await getGoogleUserInfo();
      return { success: true, userInfo };
    } catch (error) {
      console.error('[Data] Failed to fetch user info:', error);
      return { success: false, error: error.message };
    }
  });

  // Sync handlers
  ipcMain.handle('force-sync', async () => {
    console.log('[Sync] Force sync requested...');
    try {
      const syncManager = require('./src/syncManager');
      const result = await syncManager.performForceSync();
      return { success: true, result };
    } catch (error) {
      console.error('[Sync] Force sync failed:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('start-sync', async (event, syncPairs) => {
    console.log('[Sync] Starting sync with pairs:', syncPairs);
    try {
      const syncManager = require('./src/syncManager');
      const result = await syncManager.startSync(syncPairs);
      return { success: true, result };
    } catch (error) {
      console.error('[Sync] Start sync failed:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('stop-sync', async () => {
    console.log('[Sync] Stopping sync...');
    try {
      const syncManager = require('./src/syncManager');
      await syncManager.stopSync();
      return { success: true };
    } catch (error) {
      console.error('[Sync] Stop sync failed:', error);
      return { success: false, error: error.message };
    }
  });

  // Sync diagnostics
  ipcMain.handle('get-sync-status', async () => {
    try {
      const { getStats } = require('./src/syncManager');
      const stats = await getStats();
      return { success: true, stats };
    } catch (error) {
      console.error('[Sync] Get sync status failed:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-sync-stats', async () => {
    try {
      const { getStats } = require('./src/syncManager');
      const stats = await getStats();
      return { success: true, stats };
    } catch (error) {
      console.error('[Sync] Get sync stats failed:', error);
      return { success: false, error: error.message };
    }
  });

  // Plan management handlers
  ipcMain.handle('get-user-plan', async () => {
    console.log('[Plan] Getting user plan...');
    try {
      const { getUserPlan } = require('./src/planManager');
      const plan = await getUserPlan();
      return { success: true, plan };
    } catch (error) {
      console.error('[Plan] Failed to get user plan:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('set-user-plan', async (event, planData) => {
    console.log('[Plan] Setting user plan:', planData);
    try {
      const { setUserPlan } = require('./src/planManager');
      const result = await setUserPlan(planData);
      return { success: true, result };
    } catch (error) {
      console.error('[Plan] Failed to set user plan:', error);
      return { success: false, error: error.message };
    }
  });

  // Refresh plan from backend (manual)
  ipcMain.handle('refresh-plan-from-backend', async (event, { userId }) => {
    const tryFetchPlan = async (url) => {
      const resp = await fetch(url);
      const text = await resp.text();
      const data = JSON.parse(text);
      if (!data.success) throw new Error(data.error || 'fetch_failed');
      return data.plan || null;
    };

    try {
      if (!userId) throw new Error('missing_userId');

      // 1) Try remote backend first (if configured)
      let plan = null;
      if (process.env.BACKEND_URL) {
        const remoteUrl = `${process.env.BACKEND_URL}/api/plan/current?userId=${encodeURIComponent(userId)}`;
        try {
          plan = await tryFetchPlan(remoteUrl);
        } catch (e) {
          console.warn('[Plan] Remote fetch failed, will try local webhook server:', e.message);
        }
      }

      // 2) Fallback to local webhook server (useful during setup/testing)
      if (!plan) {
        try {
          const localUrl = `http://localhost:3001/api/plan/current`;
          plan = await tryFetchPlan(localUrl);
        } catch (e) {
          console.error('[Plan] Local fallback also failed:', e.message);
          throw new Error('plan_fetch_failed');
        }
      }

      const { setUserPlan } = require('./src/planManager');
      await setUserPlan(plan);
      return { success: true, plan };
    } catch (e) {
      console.error('[Plan] refresh-plan-from-backend error:', e.message);
      return { success: false, error: e.message };
    }
  });

  // Auto refresh plan timer
  let __planRefreshTimer = null;
  ipcMain.handle('start-plan-auto-refresh', async (event, { userId, intervalMs = 60000 }) => {
    try {
      if (!process.env.BACKEND_URL) throw new Error('BACKEND_URL not set');
      if (!userId) throw new Error('missing_userId');
      if (__planRefreshTimer) clearInterval(__planRefreshTimer);
      __planRefreshTimer = setInterval(async () => {
        try {
          const url = `${process.env.BACKEND_URL}/api/plan/current?userId=${encodeURIComponent(userId)}`;
          const resp = await fetch(url);
          const data = await resp.json();
          if (data && data.success) {
            const { setUserPlan } = require('./src/planManager');
            await setUserPlan(data.plan || null);
            if (mainWindow && mainWindow.webContents) {
              mainWindow.webContents.send('plan-updated', data.plan || null);
            }
          }
        } catch (err) {
          console.warn('[Plan] auto-refresh failed:', err.message);
        }
      }, Math.max(15000, Number(intervalMs) || 60000));
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('stop-plan-auto-refresh', () => {
    if (__planRefreshTimer) clearInterval(__planRefreshTimer);
    __planRefreshTimer = null;
    return { success: true };
  });

  ipcMain.handle('start-trial', async () => {
    console.log('[Plan] Starting trial...');
    try {
      const { startTrial } = require('./src/planManager');
      const result = await startTrial();
      return { success: true, result };
    } catch (error) {
      console.error('[Plan] Failed to start trial:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('check-feature-access', async (event, feature) => {
    console.log('[Plan] Checking feature access:', feature);
    try {
      const { checkFeatureAccess } = require('./src/planManager');
      const hasAccess = await checkFeatureAccess(feature);
      return { success: true, hasAccess };
    } catch (error) {
      console.error('[Plan] Failed to check feature access:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-plan-limits', async () => {
    console.log('[Plan] Getting plan limits...');
    try {
      const { getPlanLimits } = require('./src/planManager');
      const limits = await getPlanLimits();
      return { success: true, limits };
    } catch (error) {
      console.error('[Plan] Failed to get plan limits:', error);
      return { success: false, error: error.message };
    }
  });

  // Data clearing handler
  ipcMain.handle('clear-all-data', async () => {
    console.log('[Settings] Clearing all data...');
    // Clear stored tokens and reset state
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('connections-cleared');
    }
    return { success: true };
  });

  console.log('✅ IPC handlers registered: OAuth, window controls, and utilities');
}

// Register custom protocol with Windows-safe handling and process argv parsing
if (app) {
  try {
    if (app.isPackaged) {
      app.setAsDefaultProtocolClient('synk');
    } else if (process.platform === 'win32') {
      // In dev on Windows, register with explicit args so Windows launches this script, not just electron.exe
      app.setAsDefaultProtocolClient('synk', process.execPath, [path.resolve(process.argv[1] || 'main-production.js')]);
    } else {
      app.setAsDefaultProtocolClient('synk');
    }
    console.log('✅ Custom protocol "synk://" registered');
  } catch (e) {
    console.warn('⚠️ Protocol registration failed:', e.message);
  }
}

// Helper to process synk:// URLs consistently
function handleProtocolUrl(url) {
  console.log('🔧 Protocol handler received URL:', url);
  if (url && url.startsWith('synk://oauth-success')) {
    try {
      const data = JSON.parse(decodeURIComponent(new URL(url).searchParams.get('data')));
      console.log('✅ OAuth success - sending to frontend');
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('oauth-success', data);
      }
    } catch (error) {
      console.error('❌ Failed to parse success data:', error.message);
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('oauth-failed', 'Failed to parse data');
      }
    }
  } else if (url && url.startsWith('synk://oauth-failed')) {
    console.log('❌ OAuth failed - sending to frontend');
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('oauth-failed', 'OAuth failed');
    }
  }
}

// App events
if (app) {
  // macOS: open-url event delivers the protocol URL here
  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleProtocolUrl(url);
  });

  // Windows/Linux: ensure single instance and consume protocol URLs from argv
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
  } else {
    app.on('second-instance', (event, argv) => {
      // Windows passes protocol URL as a normal argv string
      const urlArg = argv.find(a => typeof a === 'string' && a.startsWith && a.startsWith('synk://'));
      if (urlArg) handleProtocolUrl(urlArg);
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });
  }

  app.whenReady().then(() => {
    console.log('✅ App ready');

    // Register IPC handlers AFTER app is ready
    registerIpcHandlers();

    createWindow();

    // If app was launched initially via synk:// link on Windows/Linux, argv contains it
    const initialUrl = process.argv.find(a => typeof a === 'string' && a.startsWith && a.startsWith('synk://'));
    if (initialUrl) {
      setTimeout(() => handleProtocolUrl(initialUrl), 500);
    }

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
  console.error('❌ App is undefined - Electron not loaded properly');
}

console.log('🔧 Main process loaded - IPC handler should be working!');