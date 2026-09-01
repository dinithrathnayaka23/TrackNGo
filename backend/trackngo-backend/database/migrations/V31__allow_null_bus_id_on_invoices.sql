-- V31: Allow bus_id to be NULL for contract-level invoices (carried balance, adjustments)
ALTER TABLE corporate_invoices
    MODIFY COLUMN bus_id BIGINT(20) NULL;
