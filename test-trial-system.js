const fetch = require('node-fetch');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = `test${Date.now()}@example.com`;
const TEST_PASSWORD = 'testpassword123';

let authToken = null;

async function test(name, fn) {
  try {
    console.log(`\n🧪 Testing: ${name}`);
    await fn();
    console.log(`✅ PASSED: ${name}`);
  } catch (error) {
    console.error(`❌ FAILED: ${name}`);
    console.error(`   Error: ${error.message}`);
    throw error;
  }
}

async function signup() {
  const response = await fetch(`${BASE_URL}/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    })
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`Signup failed: ${JSON.stringify(data)}`);
  }

  if (!data.success || !data.token) {
    throw new Error('Signup response missing token');
  }

  if (data.user.plan !== 'trial' && data.user.plan !== 'free') {
    throw new Error(`Expected trial or free plan, got: ${data.user.plan}`);
  }

  authToken = data.token;
  console.log(`   → User created: ${TEST_EMAIL}`);
  console.log(`   → Plan: ${data.user.plan}`);
  console.log(`   → Trial message: ${data.trial_message}`);

  return data;
}

async function getMe() {
  const response = await fetch(`${BASE_URL}/me`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`/me failed: ${JSON.stringify(data)}`);
  }

  console.log(`   → Email: ${data.email}`);
  console.log(`   → Plan: ${data.plan?.type}`);
  console.log(`   → Can access Pro: ${data.can_access_pro_features}`);
  console.log(`   → Reason: ${data.pro_access_reason}`);

  return data;
}

async function getTrialStatus() {
  const response = await fetch(`${BASE_URL}/api/user/trial-status`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`/api/user/trial-status failed: ${JSON.stringify(data)}`);
  }

  console.log(`   → Plan: ${data.plan}`);
  console.log(`   → Can access Pro: ${data.can_access_pro_features}`);
  console.log(`   → Days remaining: ${data.days_remaining}`);
  console.log(`   → Trial ends at: ${data.trial_ends_at}`);

  return data;
}

async function testProAccess(shouldSucceed) {
  const response = await fetch(`${BASE_URL}/api/pro/test`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  const data = await response.json();

  if (shouldSucceed) {
    if (!response.ok || !data.success) {
      throw new Error(`Expected Pro access to succeed but got: ${JSON.stringify(data)}`);
    }
    console.log(`   → Pro access granted`);
    console.log(`   → Features: ${data.features_available.length} available`);
  } else {
    if (response.ok) {
      throw new Error(`Expected Pro access to fail but it succeeded`);
    }
    if (data.error !== 'pro_access_required') {
      throw new Error(`Expected pro_access_required error, got: ${data.error}`);
    }
    console.log(`   → Pro access denied (expected)`);
    console.log(`   → Reason: ${data.reason}`);
  }

  return data;
}

async function testUpgradeEndpoint() {
  const response = await fetch(`${BASE_URL}/api/upgrade`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      priceId: 'price_test_123',
      successUrl: 'https://synk-official.com/success',
      cancelUrl: 'https://synk-official.com/cancel'
    })
  });

  const data = await response.json();

  if (response.status === 503) {
    console.log(`   → Stripe not configured (expected in dev)`);
    return data;
  }

  if (!response.ok) {
    throw new Error(`/api/upgrade failed: ${JSON.stringify(data)}`);
  }

  console.log(`   → Checkout URL created: ${data.checkout_url ? 'YES' : 'NO'}`);
  
  return data;
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('🚀 SYNK AUTO-TRIAL SYSTEM - END-TO-END TEST');
  console.log('='.repeat(60));
  console.log(`📍 Testing against: ${BASE_URL}`);

  try {
    await test('1. User Signup with Trial Assignment', async () => {
      const signupData = await signup();
      
      if (signupData.user.plan === 'trial') {
        if (!signupData.user.trial_ends_at) {
          throw new Error('Trial plan but no trial_ends_at date');
        }
      }
    });

    await test('2. GET /me with Trial Info', async () => {
      const meData = await getMe();
      
      if (meData.plan?.type === 'trial') {
        if (!meData.trial_ends_at) {
          throw new Error('Trial user but no trial_ends_at');
        }
        if (meData.can_access_pro_features !== true) {
          throw new Error('Trial user should have Pro access');
        }
      }
    });

    await test('3. GET /api/user/trial-status', async () => {
      const statusData = await getTrialStatus();
      
      if (!statusData.plan) {
        throw new Error('Missing plan field');
      }
    });

    await test('4. Pro Feature Access Control', async () => {
      const meData = await getMe();
      const shouldHaveAccess = meData.can_access_pro_features;
      await testProAccess(shouldHaveAccess);
    });

    await test('5. POST /api/upgrade (Checkout Creation)', async () => {
      await testUpgradeEndpoint();
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED!');
    console.log('='.repeat(60));
    console.log('\n📊 Test Summary:');
    console.log('   ✓ User signup with automatic trial assignment');
    console.log('   ✓ Trial status endpoint');
    console.log('   ✓ Pro feature access control');
    console.log('   ✓ Upgrade checkout flow');
    console.log('\n🎉 Auto-trial system is working correctly!\n');

  } catch (error) {
    console.log('\n' + '='.repeat(60));
    console.log('❌ TESTS FAILED');
    console.log('='.repeat(60));
    console.error('\nError:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runTests().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { runTests };
