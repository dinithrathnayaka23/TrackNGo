-- V30: Corporate Contract Billing Cycle, Payment Due Dates, and Renewal Balance Carryover

-- 1. Add carried_balance to corporate_contract to store unpaid balances carried over from renewed contracts
ALTER TABLE corporate_contract
    ADD COLUMN carried_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00;

-- 2. Add invoice_type and reminder_sent_at to corporate_invoices
ALTER TABLE corporate_invoices
    ADD COLUMN invoice_type VARCHAR(32) NOT NULL DEFAULT 'monthly',
    ADD COLUMN reminder_sent_at TIMESTAMP NULL;
