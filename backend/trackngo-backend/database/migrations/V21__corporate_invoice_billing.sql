-- corporate_invoices previously existed only in a raw SQL dump/seed file with
-- hand-inserted fake rows and no real migration history, and no Java code
-- ever wrote to it. This recreates it as the real, per-bus monthly billing
-- table backing the corporate billing screen. Dropping it is safe: it only
-- ever held disposable seed data, never anything from real usage.
DROP TABLE IF EXISTS corporate_invoices;

CREATE TABLE corporate_invoices (
    invoice_number BIGINT AUTO_INCREMENT PRIMARY KEY,
    contract_id BIGINT NOT NULL,
    bus_id BIGINT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    status ENUM('pending', 'paid', 'overdue', 'cancelled') NOT NULL DEFAULT 'pending',
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    due_date DATE NOT NULL,
    stripe_transaction_id VARCHAR(255) NULL,
    paid_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (contract_id) REFERENCES corporate_contract(contract_id) ON DELETE CASCADE,
    FOREIGN KEY (bus_id) REFERENCES bus(bus_id) ON DELETE RESTRICT,
    INDEX idx_contract (contract_id),
    INDEX idx_bus (bus_id)
);
