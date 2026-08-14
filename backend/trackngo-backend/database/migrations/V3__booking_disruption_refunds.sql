-- Run once after V2 and before deploying the disruption workflow.

ALTER TABLE payment
    ADD COLUMN provider_transaction_id VARCHAR(255) NULL,
    ADD INDEX idx_provider_transaction (provider_transaction_id);

ALTER TABLE seat_booking
    ADD COLUMN cancellation_reason TEXT NULL;

ALTER TABLE refund
    ADD COLUMN disruption_key VARCHAR(160) NULL,
    ADD COLUMN provider_refund_id VARCHAR(255) NULL,
    ADD COLUMN last_error TEXT NULL,
    ADD COLUMN attempt_count INT NOT NULL DEFAULT 0,
    ADD UNIQUE KEY uq_refund_disruption_key (disruption_key),
    ADD INDEX idx_provider_refund (provider_refund_id);
