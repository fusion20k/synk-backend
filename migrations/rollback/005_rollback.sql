-- Rollback Migration 005: Remove Email Verified Column
-- Removes email_verified column and associated index

-- Remove index
DROP INDEX IF EXISTS idx_users_email_verified;

-- Remove email_verified column
ALTER TABLE users DROP COLUMN IF EXISTS email_verified;
