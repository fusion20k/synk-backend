-- Migration 004: Add Stripe Subscription ID
-- Adds stripe_subscription_id field to track subscription separate from customer ID
-- This enables proper subscription lifecycle management (upgrades, downgrades, cancellations)

-- Add stripe_subscription_id column
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);

-- Create index for efficient subscription lookups (used by webhooks)
CREATE INDEX IF NOT EXISTS idx_users_stripe_subscription 
  ON users(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN users.stripe_subscription_id IS 'Stripe subscription ID (sub_xxx) for Pro users, separate from customer ID';
