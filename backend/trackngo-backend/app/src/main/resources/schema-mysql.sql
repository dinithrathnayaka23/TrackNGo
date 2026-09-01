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

ALTER TABLE bus ADD COLUMN IF NOT EXISTS return_start_time TIME NULL;
ALTER TABLE bus ADD COLUMN IF NOT EXISTS return_end_time TIME NULL;

ALTER TABLE bus_locations ADD COLUMN IF NOT EXISTS name VARCHAR(255) NULL;
ALTER TABLE bus_locations ADD COLUMN IF NOT EXISTS bus_number VARCHAR(50) NULL;
ALTER TABLE bus_locations ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8) NULL;
ALTER TABLE bus_locations ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8) NULL;
ALTER TABLE bus_locations ADD COLUMN IF NOT EXISTS heading DECIMAL(6, 2) NULL;
ALTER TABLE bus_locations ADD COLUMN IF NOT EXISTS speed DECIMAL(6, 2) NULL;
ALTER TABLE bus_locations ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Backfill return schedules for existing route buses when missing:
-- return_start_time = forward start + route duration + 45-minute layover
-- return_end_time   = return_start_time + route duration
UPDATE bus b
JOIN route r ON b.route_id = r.route_id
SET b.return_start_time = COALESCE(
    b.return_start_time,
    ADDTIME(
        b.start_time,
        SEC_TO_TIME((COALESCE(r.estimated_time_duration, 0) + 45) * 60)
    )
)
WHERE b.route_id IS NOT NULL
  AND b.start_time IS NOT NULL;

UPDATE bus b
JOIN route r ON b.route_id = r.route_id
SET b.return_end_time = COALESCE(
    b.return_end_time,
    ADDTIME(
        COALESCE(
            b.return_start_time,
            ADDTIME(
                b.start_time,
                SEC_TO_TIME((COALESCE(r.estimated_time_duration, 0) + 45) * 60)
            )
        ),
        SEC_TO_TIME(COALESCE(r.estimated_time_duration, 0) * 60)
    )
)
WHERE b.route_id IS NOT NULL
  AND b.start_time IS NOT NULL;

-- Ensure unique constraint
ALTER TABLE conversation ADD CONSTRAINT IF NOT EXISTS unique_participants UNIQUE (
    participant_min_id,
    participant_min_type,
    participant_max_id,
    participant_max_type
);

CREATE TABLE IF NOT EXISTS promotion (
    promotion_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(160) NOT NULL,
    description TEXT,
    target_type VARCHAR(40) NOT NULL,
    discount_type VARCHAR(30) NOT NULL,
    discount_value DECIMAL(10, 2) NOT NULL,
    promo_code VARCHAR(60) UNIQUE,
    regular_customer_min_completed_bookings INT,
    max_bookings INT NOT NULL,
    used_bookings INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status_target (status, target_type),
    INDEX idx_promo_code (promo_code)
);

CREATE TABLE IF NOT EXISTS promotion_redemption (
    redemption_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    promotion_id BIGINT NOT NULL,
    passenger_id BIGINT NOT NULL,
    booking_reference VARCHAR(50) UNIQUE NOT NULL,
    discount_amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_promotion (promotion_id),
    INDEX idx_passenger (passenger_id),
    INDEX idx_created (created_at DESC)
);

CREATE TABLE IF NOT EXISTS ai_chat_message (
    ai_chat_message_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    chat_id VARCHAR(120) NOT NULL,
    user_id BIGINT NULL,
    user_email VARCHAR(255) NULL,
    role VARCHAR(30) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ai_chat_message_chat (chat_id, created_at),
    INDEX idx_ai_chat_message_user (user_id, created_at)
);

CREATE TABLE IF NOT EXISTS ai_agent_interaction (
    ai_agent_interaction_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    chat_id VARCHAR(120) NOT NULL,
    user_id BIGINT NULL,
    user_email VARCHAR(255) NULL,
    detected_intent VARCHAR(80) NULL,
    status VARCHAR(40) NOT NULL,
    latency_ms INT NULL,
    model_name VARCHAR(120) NULL,
    error_message TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ai_agent_interaction_chat (chat_id, created_at),
    INDEX idx_ai_agent_interaction_intent (detected_intent, status)
);

CREATE TABLE IF NOT EXISTS ai_feedback (
    ai_feedback_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    chat_id VARCHAR(120) NOT NULL,
    ai_chat_message_id BIGINT NULL,
    user_id BIGINT NULL,
    rating TINYINT NOT NULL,
    comment TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ai_feedback_chat (chat_id),
    INDEX idx_ai_feedback_user (user_id)
);

CREATE TABLE IF NOT EXISTS ai_domain_knowledge (
    ai_domain_knowledge_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(180) NOT NULL,
    content TEXT NOT NULL,
    tags VARCHAR(255) NOT NULL DEFAULT 'all',
    priority INT NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FULLTEXT KEY ft_ai_domain_knowledge (title, content),
    INDEX idx_ai_domain_knowledge_active (active, priority)
);

ALTER TABLE seat_booking ADD COLUMN IF NOT EXISTS cancellation_status VARCHAR(32) DEFAULT 'none';
ALTER TABLE seat_booking ADD COLUMN IF NOT EXISTS cancellation_requested_by VARCHAR(32) NULL;
ALTER TABLE seat_booking ADD COLUMN IF NOT EXISTS cancellation_requested_at DATETIME NULL;
ALTER TABLE seat_booking ADD COLUMN IF NOT EXISTS cancellation_reject_reason TEXT NULL;
ALTER TABLE seat_booking ADD COLUMN IF NOT EXISTS refund_percentage INT NULL;

ALTER TABLE trip_booking ADD COLUMN IF NOT EXISTS cancellation_status VARCHAR(32) DEFAULT 'none';
ALTER TABLE trip_booking ADD COLUMN IF NOT EXISTS cancellation_reason TEXT NULL;
ALTER TABLE trip_booking ADD COLUMN IF NOT EXISTS cancellation_requested_by VARCHAR(32) NULL;
ALTER TABLE trip_booking ADD COLUMN IF NOT EXISTS cancellation_requested_at DATETIME NULL;
ALTER TABLE trip_booking ADD COLUMN IF NOT EXISTS cancellation_reject_reason TEXT NULL;
ALTER TABLE trip_booking ADD COLUMN IF NOT EXISTS refund_percentage INT NULL;

