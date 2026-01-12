-- Migration 005: Add Email Verified Column
-- Adds email_verified tracking to support email verification during signup
-- This migration enables the two-stage user creation: Supabase Auth first, then database after verification

-- Add email_verified column
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;

-- Create index for efficient verified user queries
CREATE INDEX IF NOT EXISTS idx_users_email_verified 
  ON users(email_verified);

-- Comment for documentation
COMMENT ON COLUMN users.email_verified IS 'True if user verified their email address during signup';
