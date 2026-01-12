// Quick test to call signup endpoint directly
const fetch = require('node-fetch');

const BACKEND_URL = 'https://synk-web.onrender.com';
const testEmail = `test-${Date.now()}@example.com`;

async function testSignup() {
  console.log(`Testing signup with: ${testEmail}`);
  
  try {
    const response = await fetch(`${BACKEND_URL}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'TestPassword123!'
      })
    });

    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
    console.log('\nPlan assigned:', data.user?.plan);
    console.log('Trial ends at:', data.user?.trial_ends_at);
    console.log('Trial message:', data.trial_message);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testSignup();
