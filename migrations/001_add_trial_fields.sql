-- Migration 001: Add Trial Fields
-- Adds backend-managed trial tracking fields to users table
-- This migration supports the auto-trial system where trials are managed by the backend, not Stripe

-- Add new trial tracking columns
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signup_ip VARCHAR(45);

-- Create index for efficient trial expiration queries (used by daily cron job)
CREATE INDEX IF NOT EXISTS idx_users_trial_expiration 
  ON users(plan, trial_ends_at) 
  WHERE plan = 'trial';

-- Create index for IP-based trial abuse prevention
CREATE INDEX IF NOT EXISTS idx_users_signup_ip 
  ON users(signup_ip) 
  WHERE signup_ip IS NOT NULL;

-- Comments for documentation
COMMENT ON COLUMN users.trial_started_at IS 'Timestamp when user trial began (backend-managed)';
COMMENT ON COLUMN users.trial_ends_at IS 'Timestamp when user trial expires (backend-managed)';
COMMENT ON COLUMN users.signup_ip IS 'IP address used during signup (for trial abuse prevention)';
