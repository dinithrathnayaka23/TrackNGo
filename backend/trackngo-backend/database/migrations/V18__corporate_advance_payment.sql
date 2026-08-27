-- Add advance payment tracking to corporate_contract
ALTER TABLE corporate_contract
    ADD COLUMN advance_amount DECIMAL(10,2) NULL COMMENT 'Deposit = 1× monthly billing_amount',
    ADD COLUMN advance_payment_status ENUM('pending', 'paid', 'waived', 'refunded') NOT NULL DEFAULT 'pending',
    ADD COLUMN advance_paid_at TIMESTAMP NULL,
    ADD COLUMN advance_transaction_id VARCHAR(255) NULL;
