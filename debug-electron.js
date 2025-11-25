console.log('NODE_PATH:', process.env.NODE_PATH);
console.log('Current directory:', __dirname);
console.log('Attempting to require electron...\n');

try {
  const electron = require('electron');
  console.log('typeof electron:', typeof electron);
  console.log('electron is null?:', electron === null);
  console.log('electron is undefined?:', electron === undefined);
  console.log('electron.toString():', electron.toString());
  console.log('electron.substring?:', typeof electron.substring);
  
  if (typeof electron === 'string') {
    console.log('\n❌ ERROR: electron is a STRING, not an object!');
    console.log('String value:', electron);
  } else {
    console.log('\n✅ electron is an object');
    console.log('Keys:', Object.keys(electron).slice(0, 10));
    console.log('app:', electron.app);
    console.log('BrowserWindow:', electron.BrowserWindow);
  }
} catch (err) {
  console.error('❌ Failed to require electron:', err.message);
  console.error(err.stack);
}