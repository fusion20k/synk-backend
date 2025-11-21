-- Migration: Update plan names from pro/ultimate to free/pro
-- This migration updates the users table to support the new plan naming:
-- - 'pro' -> 'free'
-- - 'ultimate' -> 'pro'
-- - NULL stays NULL

-- Step 1: If there's an existing CHECK constraint on plan, remove it
-- (Supabase typically doesn't have CHECK constraints by default, but this is a safeguard)
-- ALTER TABLE users DROP CONSTRAINT IF EXISTS plan_check;

-- Step 2: Migrate existing data
-- This updates all existing users with the old plan names to the new ones
UPDATE users SET plan = 'free' WHERE plan = 'pro';
UPDATE users SET plan = 'pro' WHERE plan = 'ultimate';

-- Step 3: Add new CHECK constraint if needed (optional, but recommended)
-- Uncomment this if you want to enforce valid plan values at the database level
-- ALTER TABLE users 
-- ADD CONSTRAINT plan_check CHECK (plan IN ('free', 'pro', NULL));

-- Complete! The plan column now supports 'free', 'pro', or NULL values
-- All existing 'pro' records are now 'free'
-- All existing 'ultimate' records are now 'pro'
