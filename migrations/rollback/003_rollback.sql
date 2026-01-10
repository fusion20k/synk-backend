-- Rollback for Migration 003: Create Checkout Sessions Table
-- Use this to undo migration 003 if needed

-- Drop the entire table (CASCADE removes dependent objects)
DROP TABLE IF EXISTS checkout_sessions CASCADE;
