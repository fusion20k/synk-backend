const electron = require('electron');
console.log('===== ELECTRON MODULE CONTENTS =====');
console.log(JSON.stringify(Object.keys(electron), null, 2));
console.log('\n===== CHECKING app PROPERTY =====');
console.log('app:', typeof electron.app);
console.log('app value:', electron.app);

if (electron.app) {
  console.log('App ready event:', typeof electron.app.on);
}