const electron = require('electron');
console.log('Electron object:', electron);
console.log('App object:', electron.app);
console.log('Type of app:', typeof electron.app);

if (electron.app) {
  electron.app.whenReady().then(() => {
    console.log('✅ Electron app is ready!');
    electron.app.quit();
  });
} else {
  console.error('❌ electron.app is undefined!');
  process.exit(1);
}