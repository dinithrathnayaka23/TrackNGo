-- Initialize conversation table with proper schema if it doesn't exist
-- This ensures all columns including generated columns are created correctly

ALTER TABLE conversation ADD INDEX IF NOT EXISTS idx_participant_1 (participant_1_id, participant_1_type);
ALTER TABLE conversation ADD INDEX IF NOT EXISTS idx_participant_2 (participant_2_id, participant_2_type);
ALTER TABLE conversation ADD INDEX IF NOT EXISTS idx_updated (updated_at DESC);

ALTER TABLE conversation ADD COLUMN IF NOT EXISTS last_message_type ENUM('text', 'image', 'voice', 'location', 'system') NULL;

ALTER TABLE chat_message ADD COLUMN IF NOT EXISTS recipient_id BIGINT NULL;
ALTER TABLE chat_message ADD COLUMN IF NOT EXISTS client_message_id VARCHAR(255) NULL;
ALTER TABLE chat_message ADD COLUMN IF NOT EXISTS compressed_media_url TEXT NULL;
ALTER TABLE chat_message ADD COLUMN IF NOT EXISTS file_name VARCHAR(255) NULL;
ALTER TABLE chat_message ADD COLUMN IF NOT EXISTS media_mime_type VARCHAR(100) NULL;
ALTER TABLE chat_message ADD COLUMN IF NOT EXISTS media_size_bytes BIGINT NULL;
ALTER TABLE chat_message ADD COLUMN IF NOT EXISTS compressed_size_bytes BIGINT NULL;
ALTER TABLE chat_message ADD COLUMN IF NOT EXISTS duration_seconds INT NULL;
ALTER TABLE chat_message ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP NULL;
ALTER TABLE chat_message ADD COLUMN IF NOT EXISTS read_at TIMESTAMP NULL;

-- Ensure unique constraint
ALTER TABLE conversation ADD CONSTRAINT IF NOT EXISTS unique_participants UNIQUE (
    participant_min_id,
    participant_min_type,
    participant_max_id,
    participant_max_type
);
