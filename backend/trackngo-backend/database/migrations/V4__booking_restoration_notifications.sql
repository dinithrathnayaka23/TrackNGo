-- Run after V3 before deploying the repaired/active restoration workflow.

ALTER TABLE seat_booking
    ADD COLUMN restoration_notified_at TIMESTAMP NULL,
    ADD INDEX idx_restoration_notification (restoration_notified_at);
