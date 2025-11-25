# Fix Plan Check Constraint in Supabase

## Problem
You're getting this error when setting a user's plan to 'free':
```
ERROR: 23514: new row for relation "users" violates check constraint "users_plan_check"
```

This happens because the database has a CHECK constraint that only allows 'pro' and 'ultimate' values, but not 'free'.

## Solution
Run the SQL migration in Supabase to update the CHECK constraint:

### Steps:
1. Go to your Supabase project
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the entire contents of `migrations/fix_plan_check_constraint.sql`
5. Click **Run** or press `Ctrl+Enter`

### The SQL:
```sql
-- Drop the existing CHECK constraint that's blocking 'free'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_plan_check;

-- Add new CHECK constraint with correct plan values
ALTER TABLE users 
ADD CONSTRAINT users_plan_check CHECK (plan IN ('free', 'pro', NULL));
```

## What This Does
- **Removes** the old constraint that only allowed 'pro' and 'ultimate'
- **Adds** a new constraint that allows:
  - `'free'` - New Free plan
  - `'pro'` - New Pro plan (replaces old Ultimate)
  - `NULL` - No plan yet (trial plans have been removed)

## After Running This
You'll be able to:
✅ Set users to the 'free' plan
✅ Set users to the 'pro' plan
✅ Migrate existing data without constraint violations

## Verification
Once complete, try setting a user's plan to 'free' again - it should work!
