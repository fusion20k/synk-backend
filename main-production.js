const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

console.log('🚀 Synk starting...');
console.log('__dirname:', __dirname);
console.log('process.versions.electron:', process.versions.electron);
console.log('process.type:', process.type);

// Try using require with electron.exe path directly
let app, BrowserWindow, ipcMain, shell;

try {
  // In Electron, this should work - the electron module is special
  const electron = require.cache[require.resolve('electron')];
  console.log('Electron cache:', electron ? 'found' : 'not found');
  
  // Try getting from global or process
  if (global.ELECTRON_REQUIRE) {
    const result = global.ELECTRON_REQUIRE('electron');
    if (result && typeof result === 'object') {
      console.log('✅ Got electron from global.ELECTRON_REQUIRE');
      app = result.app;
      BrowserWindow = result.BrowserWindow;
      ipcMain = result.ipcMain;
      shell = result.shell;
    }
  }
  
  // If still not set, try process.mainModule
  if (!app && process.mainModule) {
    const electron = process.mainModule.require('electron');
    if (electron && typeof electron === 'object') {
      console.log('✅ Got electron from process.mainModule.require');
      app = electron.app;
      BrowserWindow = electron.BrowserWindow;
      ipcMain = electron.ipcMain;
      shell = electron.shell;
    }
  }
  
} catch (err) {
  console.error('Error during electron lookup:', err.message);
}

if (!app) {
  console.error('❌ Could not load Electron APIs');
  console.error('Available globals:', Object.keys(global).filter(k => k.includes('electron') || k.includes('ELECTRON')).slice(0, 5));
  process.exit(1);
}

console.log('✅ Electron loaded successfully');

let mainWindow;

app.on('ready', () => {
  console.log('📱 Creating window...');
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  
  const uiPath = path.join(__dirname, 'ui', 'index.html');
  if (require('fs').existsSync(uiPath)) {
    mainWindow.loadFile(uiPath);
  } else {
    console.warn('UI path not found, showing placeholder');
    mainWindow.loadURL(`data:text/html,<h1>Synk App</h1><p>UI not found at ${uiPath}</p>`);
  }
  
  mainWindow.show();
  mainWindow.webContents.openDevTools();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

console.log('✅ Main process ready');