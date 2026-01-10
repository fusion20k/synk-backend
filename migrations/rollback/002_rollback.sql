-- Rollback for Migration 002: Update Plan Constraint
-- Use this to undo migration 002 if needed

-- Drop the new constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_plan_check;

-- Restore the old constraint (free and pro only)
ALTER TABLE users 
  ADD CONSTRAINT users_plan_check 
  CHECK (plan IN ('free', 'pro'));
