-- Migration: Fix plan CHECK constraint to support new plan values
-- This migration updates the CHECK constraint on the users table to allow 'free' and 'pro' plans
-- Previously it only allowed 'pro' and 'ultimate'

-- Step 1: Drop the existing CHECK constraint that's blocking 'free'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_plan_check;

-- Step 2: Add new CHECK constraint with correct plan values
ALTER TABLE users 
ADD CONSTRAINT users_plan_check CHECK (plan IN ('free', 'pro', NULL));

-- Done! The plan column now accepts 'free', 'pro', or NULL
-- You can now set user plans to 'free' without errors
-- Note: Trial plans have been removed entirely from the system
