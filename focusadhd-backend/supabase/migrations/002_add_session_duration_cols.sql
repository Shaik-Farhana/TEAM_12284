-- Add ended_at to learning_sessions
ALTER TABLE learning_sessions ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

-- Add focus_seconds to session_analytics
ALTER TABLE session_analytics ADD COLUMN IF NOT EXISTS focus_seconds INTEGER DEFAULT 0 NOT NULL;

-- Backfill focus_seconds for existing records using available duration and distraction data
UPDATE session_analytics 
SET focus_seconds = GREATEST(0, duration_seconds - total_distraction_seconds)
WHERE focus_seconds = 0;
