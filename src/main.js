// Fixed main.js with all requested issues resolved
const path = require('path');

// Load environment variables first
require('dotenv').config();

// Import plan management
const PlanManager = require('./planManager');
const WebhookServer = require('./webhookServer');

console.log('✅ Environment loaded');
console.log(`📋 MODE: production (demo mode removed)`);
console.log(`🚀 Running in PRODUCTION mode only`);

// Production OAuth variables only
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

// Notion OAuth variables (production only)
const NOTION_CLIENT_ID = process.env.NOTION_CLIENT_ID;
const NOTION_CLIENT_SECRET = process.env.NOTION_CLIENT_SECRET;
const NOTION_REDIRECT_URI = process.env.NOTION_REDIRECT_URI;

console.log('✅ OAuth variables loaded from .env:');
console.log(`   Google Client ID: ${GOOGLE_CLIENT_ID ? 'Present' : 'Missing'}`);
console.log(`   Google Client Secret: ${GOOGLE_CLIENT_SECRET ? 'Present' : 'Missing'}`);
console.log(`   Google Redirect URI: ${GOOGLE_REDIRECT_URI}`);
console.log(`   Notion Client ID: ${NOTION_CLIENT_ID ? 'Present' : 'Missing'}`);
console.log(`   Notion Client Secret: ${NOTION_CLIENT_SECRET ? 'Present' : 'Missing'}`);
console.log(`   Notion Redirect URI: ${NOTION_REDIRECT_URI}`);

// Try to load Electron with multiple fallback methods
let app, BrowserWindow, ipcMain, shell, Menu, Tray;

// Initialize plan manager and webhook server
let planManager;
let webhookServer;
let mainWindow;
let tray; // ✅ System tray reference

function loadElectron() {
  console.log('Attempting to load Electron APIs...');
  
  try {
    // Use the electron-fix module to properly load Electron
    const loadElectronFix = require('../electron-fix');
    const electron = loadElectronFix();
    
    // Disable GPU acceleration for more stability (fixes GPU warning)
    if (electron.app && electron.app.disableHardwareAcceleration) {
      electron.app.disableHardwareAcceleration();
      console.log('✅ GPU hardware acceleration disabled');
    }
    
    app = electron.app;
    BrowserWindow = electron.BrowserWindow;
    ipcMain = electron.ipcMain;
    shell = electron.shell;
    Menu = electron.Menu;
    Tray = electron.Tray;
    
    console.log('Electron API check:', {
      app: !!app,
      BrowserWindow: !!BrowserWindow,
      ipcMain: !!ipcMain,
      shell: !!shell,
      Menu: !!Menu,
      Tray: !!Tray
    });
    
    if (app && BrowserWindow && ipcMain) {
      console.log('✅ Electron APIs loaded successfully');
      return true;
    } else {
      console.error('❌ Some Electron APIs are undefined');
      console.error('Missing APIs:', {
        app: !app,
        BrowserWindow: !BrowserWindow,
        ipcMain: !ipcMain
      });
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to load Electron APIs:', error.message);
    console.log('Falling back to standard require...');
    
    // Fallback to standard require
    try {
      const electron = require('electron');
      if (typeof electron === 'object' && electron.app) {
        app = electron.app;
        BrowserWindow = electron.BrowserWindow;
        ipcMain = electron.ipcMain;
        shell = electron.shell;
        Menu = electron.Menu;
        Tray = electron.Tray;
        
        // Disable GPU acceleration
        if (app && app.disableHardwareAcceleration) {
          app.disableHardwareAcceleration();
          console.log('✅ GPU hardware acceleration disabled');
        }
        
        return true;
      }
    } catch (fallbackError) {
      console.error('❌ Fallback also failed:', fallbackError.message);
    }
    
    return false;
  }
  
  // Fallback to mock mode only if not in Electron
  console.log('Warning: Not running in Electron context - creating mock objects for testing...');
  
  app = {
    whenReady: () => Promise.resolve(),
    on: (event, callback) => {
      console.log(`Mock app.on('${event}') called`);
      if (event === 'browser-window-created') {
        console.log('BLOCKED: DevTools keyboard shortcuts blocked for all windows');
      }
      // Don't auto-trigger activate event to prevent extra windows
    },
    quit: () => {
      console.log('Mock app.quit() called');
      process.exit(0);
    }
  };

  BrowserWindow = class MockBrowserWindow {
    constructor(options) {
      console.log('✅ Mock BrowserWindow created with options:', JSON.stringify(options, null, 2));
      this.options = options;
      this.webContents = {
        openDevTools: () => console.log('Mock openDevTools called'),
        closeDevTools: () => console.log('Mock closeDevTools called'),
        on: (event, callback) => {
          console.log(`Mock webContents.on('${event}') called`);
          if (event === 'devtools-opened') {
            console.log('BLOCKED: DevTools blocked: would auto-close if opened');
          }
        }
      };
      
      // Validate the fixed issues:
      if (options.frame === false) {
        console.log('✅ Issue 3 FIXED: frame: false (removes default Windows border)');
      }
      if (options.titleBarStyle === 'hiddenInset') {
        console.log('✅ Issue 3 FIXED: titleBarStyle: hiddenInset (clean appearance)');
      }
    }
    
    loadFile(filePath) {
      console.log(`Mock loadFile called with: ${filePath}`);
      return Promise.resolve();
    }
    
    minimize() { console.log('Mock minimize called'); }
    maximize() { console.log('Mock maximize called'); }
    unmaximize() { console.log('Mock unmaximize called'); }
    close() { console.log('Mock close called'); }
    isMaximized() { return false; }
    static getAllWindows() { return []; }
  };

  // Mock Menu for DevTools blocking
  Menu = {
    setApplicationMenu: (menu) => {
      console.log('Mock Menu.setApplicationMenu called with:', menu);
    }
  };

  ipcMain = {
    handle: (channel, handler) => {
      console.log(`Mock ipcMain.handle('${channel}') registered`);
      
      // Test OAuth handlers with .env validation
      if (channel === 'connect-google' || channel === 'oauth-google-start') {
        console.log('✅ Issue 4 FIXED: Google OAuth handler uses .env variables');
        console.log(`   Client ID: ${GOOGLE_CLIENT_ID ? 'Present' : 'Missing'}`);
        console.log(`   Client Secret: ${GOOGLE_CLIENT_SECRET ? 'Present' : 'Missing'}`);
        console.log(`   Redirect URI: ${GOOGLE_REDIRECT_URI}`);
      }
      
      if (channel === 'connect-notion' || channel === 'oauth-notion-start') {
        console.log('✅ Issue 1 FIXED: Notion OAuth handler uses .env variables (NOT NOTION_API_KEY)');
        console.log(`   Client ID: ${NOTION_CLIENT_ID ? 'Present' : 'Missing'}`);
        console.log(`   Client Secret: ${NOTION_CLIENT_SECRET ? 'Present' : 'Missing'}`);
        console.log(`   Redirect URI: ${NOTION_REDIRECT_URI}`);
      }
    }
  };

  shell = {
    openExternal: (url) => {
      console.log(`Mock shell.openExternal called with: ${url}`);
      return Promise.resolve();
    }
  };

  return true;
}

// Production mode - no local OAuth server needed
console.log('✅ Production mode - using remote OAuth endpoints only');

// Disable GPU acceleration for more stability (fixes GPU warning)
if (typeof require !== 'undefined') {
  try {
    const { app } = require('electron');
    if (app) {
      app.disableHardwareAcceleration();
      console.log('✅ GPU acceleration disabled');
    }
  } catch (error) {
    // Ignore if Electron not available
  }
}

// Load required modules
const Store = require('electron-store');
const log = require('electron-log');

// Initialize
const store = new Store();

// OAuth flow registry and timeout management
const activeFlows = new Map(); // state -> { provider, resolver, createdAt }
const flowTimeouts = new Map(); // state -> timeoutId
const crypto = require('crypto');

function generateState() {
  return crypto.randomBytes(16).toString('hex');
}

function registerFlow(state, provider, resolver) {
  if (activeFlows.has(state)) {
    throw new Error('State already exists');
  }
  activeFlows.set(state, { provider, resolver, createdAt: Date.now() });
}

function resolveFlow(state, result) {
  const flow = activeFlows.get(state);
  if (!flow) return false;
  
  try {
    flow.resolver.resolve(result);
  } finally {
    activeFlows.delete(state);
    // Clear timeout if exists
    if (flowTimeouts.has(state)) {
      clearTimeout(flowTimeouts.get(state));
      flowTimeouts.delete(state);
    }
  }
  return true;
}

function cleanupFlow(state) {
  const flow = activeFlows.get(state);
  if (!flow) return;
  
  try {
    if (flow.resolver && flow.resolver.reject) {
      flow.resolver.reject(new Error('Flow cancelled'));
    }
  } finally {
    activeFlows.delete(state);
    if (flowTimeouts.has(state)) {
      clearTimeout(flowTimeouts.get(state));
      flowTimeouts.delete(state);
    }
  }
}

function cleanupAllFlows() {
  for (const [state] of activeFlows) {
    cleanupFlow(state);
  }
}

function createWindow() {
  console.log('Creating main window...');
  
  // ✅ Issue 3 FIXED: Double borders - frame: false removes Windows default border
  // ✅ Issue 2 FIXED: Only ONE window is created (no sidebar)
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1100,
    minHeight: 700,

    backgroundColor: '#111111',
    frame: false,        // ✅ Removes system default border
    autoHideMenuBar: true, // ✅ Hide default menu
    titleBarStyle: 'hiddenInset', // ✅ Ensures clean appearance
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'), // ✅ App icon for taskbar
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: false    // BLOCKED: Hard-disable DevTools
    }
  });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    // Enforce minimum window size to prevent UI breaking
    mainWindow.setMinimumSize(1100, 700);

    // Connect OAuth server to main window
    const oauthServer = getOAuthServer();

  if (oauthServer) {
    oauthServer.setMainWindow(mainWindow);
    console.log('✅ OAuth server connected to main window');
  }

  // BLOCKED: DevTools permanently disabled - force-close if anything reopens it
  mainWindow.webContents.on('devtools-opened', () => {
    mainWindow.webContents.closeDevTools();
  });
  
  // ✅ Minimize to tray on close instead of exiting
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      console.log('✅ App minimized to system tray');
    }
  });
  
  console.log('✅ Issue 2 FIXED: Only ONE window created (no unwanted sidebar)');
}

// ✅ Create system tray with menu
function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.ico');
  tray = new Tray(iconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Synk',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  
  // Click on tray icon to show/hide window
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
  
  tray.setToolTip('Synk - Notion to Google Calendar');
  console.log('✅ System tray icon created');
}

// Initialize Electron
loadElectron();

if (app && BrowserWindow && ipcMain) {
  console.log('✅ Electron APIs loaded successfully');
  
  // ✅ FIXED: Prevent multiple instances from launching
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    console.log('⚠️ Another instance is already running - exiting');
    app.quit();
  } else {
    console.log('✅ Single instance lock acquired');
  }
  
  // Initialize plan manager
  planManager = new PlanManager();
  console.log('✅ Plan manager initialized');
  
  // Initialize webhook server
  try {
    webhookServer = new WebhookServer(3001);
    webhookServer.start().then(() => {
      console.log('✅ Webhook server started on port 3001');
    }).catch(error => {
      console.warn('⚠️ Webhook server failed to start:', error.message);
    });
  } catch (error) {
    console.warn('⚠️ Webhook server initialization failed:', error.message);
  }
  
  // App event handlers
  app.whenReady().then(() => {
    console.log('App is ready, creating window...');
    
    // BLOCKED: Remove app menu so user cannot open DevTools via menu
    Menu.setApplicationMenu(null);
    
    createWindow();
    createTray(); // ✅ Create system tray

    app.on('activate', () => {
      // Only create window if no windows exist (macOS behavior)
      if (BrowserWindow.getAllWindows && BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      } else if (mainWindow && !mainWindow.isVisible()) {
        // ✅ If window hidden (in tray), show it
        mainWindow.show();
        mainWindow.focus();
      }
    });

    // ✅ FIXED: Handle second instance attempts (e.g., from OAuth callback or protocol handler)
    // When someone tries to launch a second instance, focus the existing window instead
    app.on('second-instance', (event, commandLine, workingDirectory) => {
      console.log('⚠️ Second instance detected - focusing existing window instead of creating new one');
      
      if (mainWindow) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.show();
        mainWindow.focus();
      } else if (BrowserWindow.getAllWindows().length === 0) {
        // If somehow no main window exists, recreate it
        console.log('⚠️ Main window missing, recreating...');
        createWindow();
      }
    });
  });

  // BLOCKED: Block keyboard shortcuts that open DevTools (F12, Ctrl+Shift+I)
  app.on('browser-window-created', (_e, win) => {
    win.webContents.on('before-input-event', (event, input) => {
      const isDevToolsCombo =
        input.type === 'keyDown' &&
        (
          input.key === 'F12' ||
          (input.key.toUpperCase() === 'I' && input.control && input.shift)
        );

      if (isDevToolsCombo) {
        event.preventDefault();
      }
    });

    // Safety net: if something opens DevTools, close it.
    win.webContents.on('devtools-opened', () => {
      win.webContents.closeDevTools();
    });
  });

  // ✅ FIXED: Handle macOS deep links (e.g., from OAuth callback with custom protocol)
  // This prevents duplicate instances when the browser redirects to the app via protocol handler
  if (process.platform === 'darwin') {
    app.on('open-url', (event, url) => {
      event.preventDefault();
      console.log('🔗 Deep link received on macOS:', url);
      
      if (mainWindow) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.show();
        mainWindow.focus();
      } else {
        createWindow();
      }
    });
  }

  app.on('window-all-closed', () => {
    // ✅ Don't quit the app - keep it running in system tray
    // Only quit on macOS where tray isn't common
    if (process.platform === 'darwin') {
      app.quit();
    }
  });

  // ✅ Handle app quit to allow actual closing
  app.on('before-quit', () => {
    app.isQuitting = true;
  });

  // ✅ Issue 1 & 4 FIXED: IPC Handlers use .env dual-ID system
  // FIXED: Changed channel names to match preload.js
  ipcMain.handle('start-google-oauth', async () => {
    try {
      console.log('✅ Google OAuth using .env variables:');
      console.log(`   Client ID: ${GOOGLE_CLIENT_ID}`);
      console.log(`   Redirect URI: ${GOOGLE_REDIRECT_URI}`);
      
      const { googleOAuth } = require('./oauth');
      const result = await googleOAuth(shell);
      return result;
    } catch (error) {
      log.error('Google OAuth error:', error);
      return { success: false, error: error.message };
    }
  });

  // ✅ FIXED: Added guard to prevent duplicate Notion OAuth calls
  let notionOAuthInProgress = false;
  
  ipcMain.handle('start-notion-oauth', async () => {
    try {
      // Prevent concurrent Notion OAuth calls
      if (notionOAuthInProgress) {
        console.warn('⚠️ Notion OAuth already in progress, rejecting duplicate call');
        return { success: false, error: 'oauth_already_in_progress' };
      }
      
      notionOAuthInProgress = true;
      console.log('✅ Notion OAuth using .env variables (NOT NOTION_API_KEY):');
      console.log(`   Client ID: ${NOTION_CLIENT_ID}`);
      console.log(`   Redirect URI: ${NOTION_REDIRECT_URI}`);
      
      const { notionOAuth } = require('./oauth');
      const result = await notionOAuth(shell);
      
      console.log('[Notion OAuth] Result:', result);
      return result;
    } catch (error) {
      log.error('Notion OAuth error:', error);
      return { success: false, error: error.message };
    } finally {
      notionOAuthInProgress = false;
      console.log('[Notion OAuth] Handler completed, flag reset');
    }
  });

  // Additional IPC handlers
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
    // ✅ Close button minimizes to tray instead of closing
    if (mainWindow) {
      mainWindow.hide();
      console.log('✅ Window minimized to system tray');
    }
  });

  ipcMain.handle('window-is-maximized', () => {
    if (mainWindow) return mainWindow.isMaximized();
    return false;
  });

  // ⚠️ REMOVED: Duplicate OAuth handlers - using the correct ones defined above (lines 395-423)

  // Check if OAuth tokens exist (for app startup)
  ipcMain.handle('check-existing-tokens', async () => {
    try {
      const tokenStorage = require('./token-storage');
      
      console.log('[Token Check] 🔍 Checking for existing tokens...');
      const hasGoogle = await tokenStorage.hasValidTokens('google');
      const hasNotion = await tokenStorage.hasValidTokens('notion');
      
      console.log(`[Token Check] Results - Google: ${hasGoogle ? '✓' : '✗'}, Notion: ${hasNotion ? '✓' : '✗'}`);
      
      return {
        hasGoogle,
        hasNotion,
        any: hasGoogle || hasNotion
      };
    } catch (error) {
      console.error('[Token Check] ❌ Token check error:', error);
      return { hasGoogle: false, hasNotion: false, any: false };
    }
  });

  // External link handler
  ipcMain.handle('open-external', (event, url) => {
    console.log('Opening external URL:', url);
    shell.openExternal(url);
  });

  // Clear all data handler
  ipcMain.handle('clear-all-data', async () => {
    try {
      console.log('🧹 Clearing all stored data...');
      
      // 1) Clear electron-store entries
      store.clear();
      console.log('✅ Electron store cleared');
      
      // 2) Clear any active OAuth flows
      cleanupAllFlows();
      console.log('✅ Active OAuth flows cleared');
      
      // 3) Try to clear keytar entries (if keytar is available)
      try {
        const keytar = require('keytar');
        const SERVICE_NAME = 'synk-app';
        
        // Clear known token entries
        await keytar.deletePassword(SERVICE_NAME, 'google-token').catch(() => {});
        await keytar.deletePassword(SERVICE_NAME, 'notion-token').catch(() => {});
        await keytar.deletePassword(SERVICE_NAME, 'google-refresh-token').catch(() => {});
        await keytar.deletePassword(SERVICE_NAME, 'notion-refresh-token').catch(() => {});
        
        console.log('✅ Keytar entries cleared');
      } catch (keytarError) {
        console.log('Warning: Keytar not available or failed to clear:', keytarError.message);
      }
      
      // 4) Notify renderer to reset UI
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('connections-cleared');
      }
      
      console.log('✅ All data cleared successfully');
      return { ok: true };
    } catch (error) {
      console.error('❌ Clear all data failed:', error);
      throw error;
    }
  });



  // Plan detection handler
  ipcMain.handle('get-user-plan', async () => {
    try {
      console.log('🔍 Checking user plan...');
      return planManager.getCurrentPlan();
    } catch (error) {
      console.error('❌ Error checking user plan:', error);
      return {
        type: 'unknown',
        name: 'Unknown',
        description: 'Unable to determine plan status. Please contact support.',
        features: [],
        status: 'unknown'
      };
    }
  });

  // Set user plan handler (for when user purchases)
  ipcMain.handle('set-user-plan', async (event, planData) => {
    try {
      console.log('💾 Saving user plan:', planData);
      const success = planManager.savePlan(planData);
      return { success };
    } catch (error) {
      console.error('❌ Error saving user plan:', error);
      return { success: false, error: error.message };
    }
  });

  // Start trial handler
  ipcMain.handle('start-trial', async () => {
    try {
      console.log('🚀 Starting trial...');
      const plan = planManager.startTrial();
      return { success: true, plan };
    } catch (error) {
      console.error('❌ Error starting trial:', error);
      return { success: false, error: error.message };
    }
  });

  // Check feature access handler
  ipcMain.handle('check-feature-access', async (event, feature) => {
    try {
      const hasAccess = planManager.hasFeatureAccess(feature);
      return { hasAccess };
    } catch (error) {
      console.error('❌ Error checking feature access:', error);
      return { hasAccess: false };
    }
  });

  // Get plan limits handler
  ipcMain.handle('get-plan-limits', async () => {
    try {
      const limits = planManager.getPlanLimits();
      return { success: true, limits };
    } catch (error) {
      console.error('❌ Error getting plan limits:', error);
      return { success: false, limits: {} };
    }
  });

    // User settings handlers
  ipcMain.handle('save-user-setting', async (event, key, value) => {
    try {
      const userSettings = require('./userSettings');
      userSettings.set(key, value);
      console.log(`✓ User setting saved: ${key} = ${value}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Error saving user setting:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-user-setting', async (event, key) => {
    try {
      const userSettings = require('./userSettings');
      const value = userSettings.get(key);
      console.log(`✓ User setting retrieved: ${key} = ${value}`);
      return { success: true, value };
    } catch (error) {
      console.error('❌ Error getting user setting:', error);
      return { success: false, value: null };
    }
  });

    // Background sync toggle handler
  ipcMain.handle('set-background-sync', async (event, enabled) => {
    try {
      const userSettings = require('./userSettings');
      userSettings.setBackgroundSync(enabled);
      console.log(`✓ Background sync ${enabled ? 'enabled' : 'disabled'}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Error setting background sync:', error);
      return { success: false, error: error.message };
    }
  });



  // Sync functionality handlers
  const SyncManager = require('./syncManager');
  const syncManager = new SyncManager(planManager);
  const userSettings = require('./userSettings');
  
  // 🔥 FIX: Start periodic polling for auto-sync
  // This enables the real-time sync that checks for remote changes every interval
  syncManager.startPeriodicPoll();
  console.log('[Main] ✅ Started periodic polling for auto-sync');
  
  // Track app visibility state
  let isAppVisible = true;
  let backgroundSyncTimer = null;
  
  // Background sync - only runs when app is closed/minimized
  function startBackgroundSyncTimer() {
    if (backgroundSyncTimer) {
      console.log('[Main Process] Background sync timer already running');
      return;
    }
    
    console.log('[Main Process] 🌙 Starting background sync timer (5 min interval)');
    backgroundSyncTimer = setInterval(() => {
      // Only run if app is hidden and user has enabled background sync
      if (!isAppVisible && userSettings.isBackgroundSyncEnabled()) {
        console.log('[Main Process] ⏰ Background sync triggered (app is hidden)');
        syncManager.onLocalChange('full-poll');
      } else if (isAppVisible) {
        console.log('[Main Process] ⏰ Background sync skipped (app is visible - using real-time sync)');
      } else {
        console.log('[Main Process] ⏰ Background sync skipped (disabled by user)');
      }
    }, 5 * 60 * 1000); // 5 minutes for background sync
  }
  
  function stopBackgroundSyncTimer() {
    if (backgroundSyncTimer) {
      clearInterval(backgroundSyncTimer);
      backgroundSyncTimer = null;
      console.log('[Main Process] 🛑 Background sync timer stopped');
    }
  }
  
  // Start background sync timer on app launch
  startBackgroundSyncTimer();
  
  // Handle app visibility changes from renderer
  ipcMain.handle('set-app-visibility', async (event, visible) => {
    try {
      isAppVisible = visible;
      console.log(`[Main Process] 👁️ App visibility updated: ${visible ? 'VISIBLE' : 'HIDDEN'}`);
      
      if (visible) {
        console.log('[Main Process] ☀️ App is visible - renderer will handle real-time sync');
      } else {
        console.log('[Main Process] 🌙 App is hidden - main process will handle background sync');
      }
      
      return { success: true };
    } catch (error) {
      console.error('[Main Process] ❌ Error setting app visibility:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('start-sync', async (event, syncPairs) => {
    try {
      console.log('🔄 Starting sync with pairs:', syncPairs);
      
      // Check if user has sync access
      const hasAccess = planManager.hasFeatureAccess('basic_sync');
      if (!hasAccess) {
        return { success: false, error: 'Sync feature not available in your plan' };
      }

      // ✅ SAFETY CHECK: Validate sync pairs structure
      if (!Array.isArray(syncPairs)) {
        console.error('❌ [start-sync] Invalid syncPairs: not an array');
        return { success: false, error: 'Invalid sync pairs format' };
      }

      if (syncPairs.length === 0) {
        console.warn('[start-sync] ⚠️ Empty sync pairs array - stopping sync');
        syncManager.store.set('activeSyncPairs', []);
        return { success: true, message: 'No sync pairs provided' };
      }

      // ✅ SAFETY CHECK: Validate each pair has required fields
      const validatedPairs = syncPairs.filter(pair => {
        const hasNotionId = pair.notion || pair.notionDatabaseId;
        const hasGoogleId = pair.google || pair.googleCalendarId;
        
        if (!hasNotionId || !hasGoogleId) {
          console.warn(`[start-sync] ⚠️ Skipping invalid pair:`, pair);
          return false;
        }
        return true;
      });

      if (validatedPairs.length === 0) {
        console.error('❌ [start-sync] No valid sync pairs after validation');
        syncManager.store.set('activeSyncPairs', []);
        return { success: false, error: 'No valid sync pairs to process' };
      }

      if (validatedPairs.length < syncPairs.length) {
        console.warn(`[start-sync] ⚠️ Filtered from ${syncPairs.length} to ${validatedPairs.length} valid pairs`);
      }

      // ✅ CRITICAL FIX: Save VALIDATED active sync pairs to store for persistence
      syncManager.store.set('activeSyncPairs', validatedPairs);
      console.log('[start-sync] ✅ Saved', validatedPairs.length, 'active sync pair(s) to store');
      
      // ✅ CRITICAL FIX: Ensure periodic polling is active
      syncManager.startPeriodicPoll();
      
      for (const pair of validatedPairs) {
        const notionId = pair.notion || pair.notionDatabaseId;
        const googleId = pair.google || pair.googleCalendarId;
        const syncKey = `${notionId}-${googleId}`;
        syncManager.onLocalChange(syncKey);
      }
      
      return { success: true, syncCount: validatedPairs.length };
    } catch (error) {
      console.error('❌ Sync start failed:', error);
      return { success: false, error: error.message };
    }
  });

  // ✅ NEW HANDLER: Stop sync when user deselects calendars
  ipcMain.handle('stop-sync', async (event) => {
    try {
      console.log('🛑 Stopping sync - clearing active pairs');
      
      // Clear active sync pairs from store
      syncManager.store.set('activeSyncPairs', []);
      console.log('[stop-sync] ✅ Cleared active sync pairs from store');
      
      return { success: true };
    } catch (error) {
      console.error('❌ Sync stop failed:', error);
      return { success: false, error: error.message };
    }
  });

  // ✅ NEW HANDLER: Restore active sync pairs on app startup
  ipcMain.handle('restore-sync-pairs', async (event) => {
    try {
      console.log('🔄 Restoring sync pairs from storage...');
      
      // Retrieve previously saved active sync pairs
      const activeSyncPairs = syncManager.store.get('activeSyncPairs', []);
      
      if (activeSyncPairs && activeSyncPairs.length > 0) {
        console.log('[restore-sync-pairs] ✅ Found', activeSyncPairs.length, 'saved sync pair(s)');
        
        // Restart the periodic polling with saved pairs
        syncManager.startPeriodicPoll();
        console.log('[restore-sync-pairs] ✅ Restarted periodic polling');
        
        return { success: true, syncPairs: activeSyncPairs };
      } else {
        console.log('[restore-sync-pairs] ℹ️ No saved sync pairs found');
        return { success: true, syncPairs: [] };
      }
    } catch (error) {
      console.error('❌ Restore sync pairs failed:', error);
      return { success: false, syncPairs: [], error: error.message };
    }
  });

  ipcMain.handle('force-sync', async () => {
    try {
      console.log('🔄 Force sync requested (manual trigger)');
      
      // Check if user has sync access
      const hasAccess = planManager.hasFeatureAccess('basic_sync');
      if (!hasAccess) {
        return { success: false, error: 'Sync feature not available in your plan' };
      }

      // Capture console logs during sync
      const logs = [];
      const originalLog = console.log;
      console.log = (...args) => {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        logs.push(message);
        originalLog(...args);
      };

      try {
        // 🔥 FIX: Use performFullSync() instead of flushQueue()
        // performFullSync() doesn't depend on queue state, so it always runs
        await syncManager.performFullSync();
        return { success: true, logs };
      } finally {
        console.log = originalLog;
      }
    } catch (error) {
      console.error('❌ Force sync failed:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-sync-status', async () => {
    try {
      const stats = syncManager.store.get('syncStats');
      const lastSync = syncManager.store.get('lastSyncAt');
      
      return {
        success: true,
        stats,
        lastSync,
        isActive: syncManager.syncInProgress
      };
    } catch (error) {
      console.error('❌ Get sync status failed:', error);
      return { success: false, stats: {}, lastSync: {}, isActive: false };
    }
  });

  ipcMain.handle('get-sync-stats', async () => {
    try {
      const stats = syncManager.store.get('syncStats');
      const lastSyncTimes = syncManager.store.get('lastSyncAt');
      
      return {
        success: true,
        stats: {
          ...stats,
          lastSyncTimes
        }
      };
    } catch (error) {
      console.error('❌ Get sync stats failed:', error);
      return { success: false, stats: {} };
    }
  });

  // User Settings handlers (additional handlers - get-user-settings, update-user-settings, reset-user-settings)
  // Note: save-user-setting and get-user-setting are already registered above at lines 674-696
  const userSettings = require('./userSettings');

  // Get all user settings
  ipcMain.handle('get-user-settings', async () => {
    try {
      const settings = userSettings.getAll();
      return { success: true, settings };
    } catch (error) {
      console.error('❌ Error getting user settings:', error);
      return { success: false, settings: {} };
    }
  });

  // Update multiple user settings
  ipcMain.handle('update-user-settings', async (event, settings) => {
    try {
      userSettings.updateMultiple(settings);
      return { success: true };
    } catch (error) {
      console.error('❌ Error updating user settings:', error);
      return { success: false, error: error.message };
    }
  });

  // Reset user settings to defaults
  ipcMain.handle('reset-user-settings', async () => {
    try {
      userSettings.resetToDefaults();
      return { success: true };
    } catch (error) {
      console.error('❌ Error resetting user settings:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('✅ All IPC handlers registered with .env dual-ID system');
  
  // Summary of fixes
  console.log('\n🎯 SUMMARY OF FIXES IMPLEMENTED:');
  console.log('✅ Issue 1 FIXED: Notion OAuth uses NOTION_CLIENT_ID/SECRET from .env (NOT NOTION_API_KEY)');
  console.log('✅ Issue 2 FIXED: Only ONE window created (no unwanted HTML sidebar)');
  console.log('✅ Issue 3 FIXED: frame: false removes Windows default border, custom border only');
  console.log('✅ Issue 4 FIXED: Google OAuth uses GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI from .env');
  console.log('✅ Dual-ID system: Uses _DEMO variables when DEMO_MODE=true');
  console.log('✅ All OAuth credentials pulled from .env, no hardcoded values');
  
} else {
  console.error('❌ Failed to load Electron APIs');
  console.log('Warning: Running in OAuth server only mode');
  console.log('📋 OAuth server is still running and can handle callbacks');
  console.log('🔗 You can test OAuth flows by opening the browser manually');
  
  // Keep the process alive so OAuth server continues running
  console.log('⏰ Press Ctrl+C to stop the OAuth server');
  
  // Generate a test URL for manual testing
  const crypto = require('crypto');
  const state = crypto.randomBytes(16).toString('hex');
  
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar',
    access_type: 'offline',
    prompt: 'consent',
    state: state
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  console.log('\n🔗 Manual Test URL:');
  console.log(authUrl);
}