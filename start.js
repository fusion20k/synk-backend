// Startup script to ensure ELECTRON_RUN_AS_NODE is not set
delete process.env.ELECTRON_RUN_AS_NODE;

const { spawn } = require('child_process');
const path = require('path');

// Get electron path
const electronPath = require('electron');

// Start Electron with current directory
const child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined }
});

child.on('close', (code) => {
  process.exit(code);
});