const path = require('path');
console.log('Step 1: require statement');

try {
  console.log('Step 2: About to require electron');
  const electron = require('electron');
  console.log('Step 3: electron required, object keys:', Object.keys(electron).slice(0, 10));
  
  const { app, BrowserWindow } = electron;
  console.log('Step 4: Destructured app and BrowserWindow');
  console.log('Step 5: app object:', app ? 'EXISTS' : 'UNDEFINED');
  console.log('Step 6: typeof app:', typeof app);
  
  if (!app) {
    console.error('ERROR: app is undefined!');
    console.log('Available on electron:', Object.keys(electron).join(', '));
  }
} catch(error) {
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
}

console.log('Done');