-- Rollback for Migration 004: Add Stripe Subscription ID
-- Use this to undo migration 004 if needed

-- Drop index
DROP INDEX IF EXISTS idx_users_stripe_subscription;

-- Remove column
ALTER TABLE users 
  DROP COLUMN IF EXISTS stripe_subscription_id;
