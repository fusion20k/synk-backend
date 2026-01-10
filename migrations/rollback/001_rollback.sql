-- Rollback for Migration 001: Add Trial Fields
-- Use this to undo migration 001 if needed

-- Drop indexes
DROP INDEX IF EXISTS idx_users_trial_expiration;
DROP INDEX IF EXISTS idx_users_signup_ip;

-- Remove columns
ALTER TABLE users 
  DROP COLUMN IF EXISTS trial_started_at,
  DROP COLUMN IF EXISTS trial_ends_at,
  DROP COLUMN IF EXISTS signup_ip;
