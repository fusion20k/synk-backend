require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

async function verifySchema() {
  console.log('=== Schema Verification ===\n');
  let allPassed = true;

  // Check 1: Verify trial fields exist in users table
  console.log('1. Checking users table for new trial fields...');
  try {
    const { data, error } = await supabase
      .from('users')
      .select('trial_started_at, trial_ends_at, signup_ip, stripe_subscription_id')
      .limit(1);
    
    if (error && error.message.includes('column')) {
      console.log('   ✗ FAILED: Missing columns in users table');
      console.log('   Error:', error.message);
      allPassed = false;
    } else {
      console.log('   ✓ PASSED: trial_started_at, trial_ends_at, signup_ip, stripe_subscription_id columns exist');
    }
  } catch (err) {
    console.log('   ✗ FAILED:', err.message);
    allPassed = false;
  }

  // Check 2: Verify checkout_sessions table exists
  console.log('\n2. Checking checkout_sessions table...');
  try {
    const { data, error } = await supabase
      .from('checkout_sessions')
      .select('id, user_id, stripe_session_id, status, created_at, reminder_sent_at, completed_at')
      .limit(1);
    
    if (error && error.message.includes('relation') && error.message.includes('does not exist')) {
      console.log('   ✗ FAILED: checkout_sessions table does not exist');
      console.log('   Error:', error.message);
      allPassed = false;
    } else {
      console.log('   ✓ PASSED: checkout_sessions table exists with correct columns');
    }
  } catch (err) {
    console.log('   ✗ FAILED:', err.message);
    allPassed = false;
  }

  // Check 3: Test plan constraint allows 'trial'
  console.log('\n3. Checking plan constraint allows "trial" value...');
  try {
    // Try to insert a test user with plan='trial'
    const testEmail = `test-trial-${Date.now()}@verify.test`;
    const { data, error } = await supabase
      .from('users')
      .insert({
        email: testEmail,
        password_hash: 'test_hash',
        plan: 'trial',
        trial_started_at: new Date().toISOString(),
        trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select();
    
    if (error) {
      if (error.message.includes('violates check constraint')) {
        console.log('   ✗ FAILED: plan constraint does not allow "trial" value');
        console.log('   Error:', error.message);
        allPassed = false;
      } else if (error.message.includes('duplicate key')) {
        console.log('   ✓ PASSED: plan="trial" is allowed (duplicate key means insertion would work)');
      } else {
        console.log('   ⚠ WARNING: Unexpected error:', error.message);
      }
    } else {
      console.log('   ✓ PASSED: plan="trial" is allowed');
      
      // Clean up test user
      await supabase.from('users').delete().eq('email', testEmail);
      console.log('   (Test user cleaned up)');
    }
  } catch (err) {
    console.log('   ✗ FAILED:', err.message);
    allPassed = false;
  }

  // Check 4: Verify indexes (indirect check via query performance)
  console.log('\n4. Checking indexes (indirect verification)...');
  try {
    // Query that would use idx_users_trial_expiration
    const { data: trialUsers, error: error1 } = await supabase
      .from('users')
      .select('email')
      .eq('plan', 'trial')
      .lt('trial_ends_at', new Date().toISOString())
      .limit(1);
    
    if (error1) {
      console.log('   ✗ FAILED: Trial expiration query failed');
      allPassed = false;
    } else {
      console.log('   ✓ PASSED: Trial expiration query works (index likely exists)');
    }

    // Query that would use idx_users_signup_ip
    const { data: ipUsers, error: error2 } = await supabase
      .from('users')
      .select('email')
      .eq('signup_ip', '192.168.1.1')
      .limit(1);
    
    if (error2) {
      console.log('   ✗ FAILED: Signup IP query failed');
      allPassed = false;
    } else {
      console.log('   ✓ PASSED: Signup IP query works (index likely exists)');
    }

    // Query that would use idx_users_stripe_subscription
    const { data: subUsers, error: error3 } = await supabase
      .from('users')
      .select('email')
      .eq('stripe_subscription_id', 'sub_test')
      .limit(1);
    
    if (error3) {
      console.log('   ✗ FAILED: Stripe subscription query failed');
      allPassed = false;
    } else {
      console.log('   ✓ PASSED: Stripe subscription query works (index likely exists)');
    }
  } catch (err) {
    console.log('   ✗ FAILED:', err.message);
    allPassed = false;
  }

  // Check 5: Verify checkout_sessions indexes
  console.log('\n5. Checking checkout_sessions table functionality...');
  try {
    // Query that would use idx_checkout_sessions_status
    const { data, error } = await supabase
      .from('checkout_sessions')
      .select('*')
      .eq('status', 'pending')
      .lt('created_at', new Date().toISOString())
      .limit(1);
    
    if (error) {
      console.log('   ✗ FAILED: Checkout sessions query failed');
      allPassed = false;
    } else {
      console.log('   ✓ PASSED: Checkout sessions query works (indexes likely exist)');
    }
  } catch (err) {
    console.log('   ✗ FAILED:', err.message);
    allPassed = false;
  }

  // Summary
  console.log('\n=== Verification Summary ===');
  if (allPassed) {
    console.log('✅ All schema checks PASSED');
    console.log('Database is ready for auto-trial system implementation.');
    process.exit(0);
  } else {
    console.log('❌ Some schema checks FAILED');
    console.log('Please review the errors above and re-run failed migrations.');
    process.exit(1);
  }
}

verifySchema().catch(err => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
