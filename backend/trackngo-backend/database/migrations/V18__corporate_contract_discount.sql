-- Lets an admin apply a manual discount when approving a corporate contract,
-- mirroring the discount already supported for trip bookings
-- (see V9__trip_booking_negotiation.sql). original_billing_amount preserves
-- the auto-calculated figure so the pre-discount amount stays visible even
-- after billing_amount is reduced by the discount.
ALTER TABLE corporate_contract
    ADD COLUMN original_billing_amount DECIMAL(12, 2) NULL,
    ADD COLUMN discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN admin_note VARCHAR(500) NULL;

UPDATE corporate_contract
SET original_billing_amount = billing_amount
WHERE original_billing_amount IS NULL;
