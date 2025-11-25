#!/usr/bin/env node

// Minimal test - directly use electron CLI arguments
const path = require('path');

// Windows squirrel installer handling
if (require('electron-squirrel-startup')) {
  return;
}

// Try different import methods
console.log('Method 1: Direct require at module level');
let { app, BrowserWindow } = require('electron');

console.log('app:', app);
console.log('BrowserWindow:', BrowserWindow);

if (!app) {
  console.log('Method 2: Trying alternative approach');
  const electron = require('electron');
  console.log('electron module type:', typeof electron);
  console.log('electron keys:', Object.keys(electron).slice(0, 5));
  
  // Try to get app from global
  if (global.electron) {
    console.log('Found global.electron');
    app = global.electron.app;
  }
}

if (app) {
  console.log('✓ App object found!');
  app.on('ready', () => {
    console.log('App is ready');
    const win = new BrowserWindow({ width: 800, height: 600 });
    win.loadURL(`file://${path.join(__dirname, 'src', 'index.html')}`);
  });
} else {
  console.log('✗ App object NOT found');
  console.log('Process argv:', process.argv);
  console.log('Electron path: /node_modules/.bin/electron');
}