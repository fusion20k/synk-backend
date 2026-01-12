const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { 
      auth: { 
        persistSession: false,
        autoRefreshToken: false
      } 
    })
  : null;

async function getAuthUserByEmail(email) {
  if (!supabaseAdmin) {
    throw new Error('Supabase Admin client not configured');
  }

  const { data, error } = await supabaseAdmin.auth.admin.getUserByEmail(email);
  
  if (error) {
    throw error;
  }

  return data?.user || null;
}

async function checkEmailVerified(email) {
  if (!supabaseAdmin) {
    throw new Error('Supabase Admin client not configured');
  }

  const user = await getAuthUserByEmail(email);
  
  if (!user) {
    return false;
  }

  return !!user.email_confirmed_at;
}

async function resendVerificationEmail(email) {
  if (!supabaseAdmin) {
    throw new Error('Supabase Admin client not configured');
  }

  const { data, error } = await supabaseAdmin.auth.admin.generateEmailVerificationLink(email);
  
  if (error) {
    throw error;
  }

  return data;
}

module.exports = {
  getAuthUserByEmail,
  checkEmailVerified,
  resendVerificationEmail
};
