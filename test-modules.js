const { checkProAccess } = require('./src/accessControl');
const { isTrialExpired } = require('./src/trialManager');

console.log('='.repeat(60));
console.log('🧪 SYNK AUTO-TRIAL SYSTEM - MODULE UNIT TESTS');
console.log('='.repeat(60));

let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passedTests++;
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(`   Error: ${error.message}`);
    failedTests++;
  }
}

console.log('\n📦 Testing accessControl.checkProAccess():\n');

test('Pro user has access', () => {
  const user = { plan: 'pro' };
  const result = checkProAccess(user);
  if (!result.canAccessProFeatures) throw new Error('Pro user should have access');
  if (result.reason !== 'pro_subscription') throw new Error('Wrong reason');
});

test('Active trial user has access', () => {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const user = { 
    plan: 'trial', 
    trial_ends_at: tomorrow 
  };
  const result = checkProAccess(user);
  if (!result.canAccessProFeatures) throw new Error('Trial user should have access');
  if (result.reason !== 'active_trial') throw new Error('Wrong reason');
  if (result.daysRemaining < 1) throw new Error('Should have at least 1 day remaining');
});

test('Expired trial user has no access', () => {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const user = { 
    plan: 'trial', 
    trial_ends_at: yesterday 
  };
  const result = checkProAccess(user);
  if (result.canAccessProFeatures) throw new Error('Expired trial should not have access');
  if (result.reason !== 'expired_trial') throw new Error('Wrong reason');
  if (result.daysRemaining !== 0) throw new Error('Should have 0 days remaining');
});

test('Free user has no access', () => {
  const user = { plan: 'free' };
  const result = checkProAccess(user);
  if (result.canAccessProFeatures) throw new Error('Free user should not have access');
  if (result.reason !== 'free_plan') throw new Error('Wrong reason');
});

test('User with no plan has no access', () => {
  const user = {};
  const result = checkProAccess(user);
  if (result.canAccessProFeatures) throw new Error('User with no plan should not have access');
  if (result.reason !== 'no_plan') throw new Error('Wrong reason');
});

test('Trial without expiration date is invalid', () => {
  const user = { plan: 'trial' };
  const result = checkProAccess(user);
  if (result.canAccessProFeatures) throw new Error('Invalid trial should not have access');
  if (result.reason !== 'invalid_trial') throw new Error('Wrong reason');
});

console.log('\n📦 Testing trialManager.isTrialExpired():\n');

test('Non-trial user is not expired', () => {
  const user = { plan: 'free' };
  const result = isTrialExpired(user);
  if (result) throw new Error('Non-trial user should not be expired');
});

test('Trial user with future end date is not expired', () => {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const user = { 
    plan: 'trial', 
    trial_ends_at: tomorrow 
  };
  const result = isTrialExpired(user);
  if (result) throw new Error('Future trial should not be expired');
});

test('Trial user with past end date is expired', () => {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const user = { 
    plan: 'trial', 
    trial_ends_at: yesterday 
  };
  const result = isTrialExpired(user);
  if (!result) throw new Error('Past trial should be expired');
});

test('Trial user without end date is not expired', () => {
  const user = { plan: 'trial' };
  const result = isTrialExpired(user);
  if (result) throw new Error('Trial without end date should not be expired');
});

console.log('\n📦 Testing email templates:\n');

test('Email templates module loads correctly', () => {
  const templates = require('./src/emailTemplates');
  if (!templates.trial_welcome) throw new Error('Missing trial_welcome template');
  if (!templates.trial_expiring_soon) throw new Error('Missing trial_expiring_soon template');
  if (!templates.trial_expired) throw new Error('Missing trial_expired template');
  if (!templates.checkout_abandoned) throw new Error('Missing checkout_abandoned template');
  if (!templates.subscription_cancelled) throw new Error('Missing subscription_cancelled template');
});

test('Trial welcome template renders correctly', () => {
  const templates = require('./src/emailTemplates');
  const result = templates.trial_welcome({
    email: 'test@example.com',
    days_remaining: 7,
    trial_ends_at: new Date().toISOString(),
    upgrade_url: 'https://test.com'
  });
  if (!result.subject) throw new Error('Missing subject');
  if (!result.html) throw new Error('Missing html');
  if (!result.html.includes('Welcome to Synk Pro')) throw new Error('Template content not rendered');
  if (!result.html.includes('7 days')) throw new Error('Days remaining not in template');
  if (!result.subject.includes('7-Day Trial')) throw new Error('Days not in subject');
});

console.log('\n' + '='.repeat(60));
console.log(`📊 Test Results: ${passedTests} passed, ${failedTests} failed`);
console.log('='.repeat(60));

if (failedTests > 0) {
  console.log('\n❌ Some tests failed!');
  process.exit(1);
} else {
  console.log('\n✅ All module tests passed!');
  console.log('\n📝 Next steps:');
  console.log('   1. Configure .env with Supabase credentials');
  console.log('   2. Run migrations: Apply all 4 SQL migration files');
  console.log('   3. Configure SMTP for email notifications');
  console.log('   4. Deploy to Render and test end-to-end');
  process.exit(0);
}
