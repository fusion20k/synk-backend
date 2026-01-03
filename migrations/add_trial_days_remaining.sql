-- Migration: Add trial_days_remaining column
-- This column tracks how many days are left on a user's trial period
-- Only applicable when is_trial = true

-- Add the new column
ALTER TABLE users 
ADD COLUMN trial_days_remaining INTEGER DEFAULT NULL;

-- Add a comment to document the column
COMMENT ON COLUMN users.trial_days_remaining IS 'Number of days remaining in trial period. NULL if not on trial. Synced from Stripe subscription trial_end.';

-- Optional: Add a check constraint to ensure trial_days_remaining is non-negative
ALTER TABLE users 
ADD CONSTRAINT trial_days_remaining_check CHECK (trial_days_remaining IS NULL OR trial_days_remaining >= 0);
