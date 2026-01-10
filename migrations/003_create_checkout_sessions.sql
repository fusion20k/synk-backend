-- Migration 003: Create Checkout Sessions Table
-- Tracks Stripe checkout sessions for abandoned cart detection and reminders
-- Used by the hourly cron job to send reminder emails

-- Create checkout_sessions table
CREATE TABLE IF NOT EXISTS checkout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  stripe_session_id VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(20) CHECK (status IN ('pending', 'completed', 'abandoned')) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  reminder_sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Create index for efficient abandoned checkout queries (used by hourly cron job)
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_status 
  ON checkout_sessions(status, created_at) 
  WHERE status = 'pending';

-- Create index for Stripe session ID lookups (used by webhooks)
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_stripe_id 
  ON checkout_sessions(stripe_session_id);

-- Comments for documentation
COMMENT ON TABLE checkout_sessions IS 'Tracks Stripe checkout sessions for abandoned cart recovery';
COMMENT ON COLUMN checkout_sessions.status IS 'pending: user has not completed, completed: payment successful, abandoned: session expired';
COMMENT ON COLUMN checkout_sessions.reminder_sent_at IS 'Timestamp when 24-hour reminder email was sent';
