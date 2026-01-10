-- Migration 002: Update Plan Constraint
-- Updates the CHECK constraint on users.plan to allow 'trial' value
-- This enables the three-state plan system: trial → free → pro

-- Drop existing CHECK constraint on plan field
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_plan_check;

-- Add new CHECK constraint allowing 'trial', 'free', 'pro'
ALTER TABLE users 
  ADD CONSTRAINT users_plan_check 
  CHECK (plan IN ('trial', 'free', 'pro'));

-- Comment for documentation
COMMENT ON CONSTRAINT users_plan_check ON users IS 'Enforces three-state plan system: trial, free, pro';
