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
