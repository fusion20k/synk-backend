// Electron wrapper - manually fix require('electron') issue
const path = require('path');
const Module = require('module');

// Before loading electron, let's patch the require system
const originalRequire = Module.prototype.require;

console.log('🔧 Patching require to handle electron module correctly...\n');

Module.prototype.require = function(id) {
  // Intercept electron requires
  if (id === 'electron') {
    console.log('[Patcher] Caught require("electron"), injecting real Electron APIs...');
    
    // The electron.exe should have set up globals, check for them
    if (typeof window !== 'undefined' || typeof global.__electron !== 'undefined') {
      console.log('[Patcher] Found electron globals, using them');
      return global.__electron || window.electron;
    }
    
    // If not, try to get it from the loaded module and wrap it
    const electronPath = originalRequire.call(this, id);
    if (typeof electronPath === 'string') {
      console.log('[Patcher] electron module returned path, attempting to access APIs from process...');
      
      // Try to get from process
      if (process.versions.electron) {
        console.log('[Patcher] process.versions.electron = ' + process.versions.electron);
        // In the real Electron main process, these APIs should be available
        // Let's check if they're in require.cache or globals
        
        const cached = require.cache[require.resolve('electron')];
        if (cached && cached.exports && typeof cached.exports === 'object') {
          return cached.exports;
        }
      }
    }
    
    return originalRequire.call(this, id);
  }
  
  return originalRequire.call(this, id);
};

// Now start Electron
console.log('[Run] Starting Electron...\n');

const { spawn } = require('child_process');
const electronPath = path.join(__dirname, 'node_modules', '.bin', 'electron.cmd');

const electron = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  cwd: __dirname
});

electron.on('exit', (code) => {
  console.log(`Electron exited with code ${code}`);
  process.exit(code);
});

electron.on('error', (err) => {
  console.error('Failed to start Electron:', err);
  process.exit(1);
});