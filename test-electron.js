console.log('=== ELECTRON TEST ===');
console.log('process.versions:', JSON.stringify(process.versions, null, 2));
console.log('process.type:', process.type);

const electron = require('electron');
console.log('typeof electron:', typeof electron);
console.log('electron is string?', typeof electron === 'string');

if (typeof electron === 'object') {
  console.log('✅ SUCCESS! Electron is an object');
  console.log('electron.app exists?', !!electron.app);
  
  if (electron.app) {
    electron.app.whenReady().then(() => {
      console.log('✅ App ready!');
      const { BrowserWindow } = electron;
      const win = new BrowserWindow({ width: 800, height: 600 });
      win.loadURL('data:text/html,<h1>Electron Works!</h1>');
    });
  }
} else {
  console.log('❌ FAILED! Electron is:', typeof electron);
  console.log('Value:', electron);
  process.exit(1);
}