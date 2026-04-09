-- Initialize conversation table with proper schema if it doesn't exist
-- This ensures all columns including generated columns are created correctly

ALTER TABLE conversation ADD INDEX IF NOT EXISTS idx_participant_1 (participant_1_id, participant_1_type);
ALTER TABLE conversation ADD INDEX IF NOT EXISTS idx_participant_2 (participant_2_id, participant_2_type);
ALTER TABLE conversation ADD INDEX IF NOT EXISTS idx_updated (updated_at DESC);

-- Ensure unique constraint
ALTER TABLE conversation ADD CONSTRAINT IF NOT EXISTS unique_participants UNIQUE (
    participant_min_id,
    participant_min_type,
    participant_max_id,
    participant_max_type
);
