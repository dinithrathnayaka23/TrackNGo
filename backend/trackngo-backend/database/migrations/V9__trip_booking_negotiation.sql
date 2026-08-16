-- Stores the estimate separately from the administrator's negotiated total.
-- Apply this migration before deploying the negotiation/payment flow.
ALTER TABLE trip_booking
    ADD COLUMN estimated_price DECIMAL(10,2) NULL AFTER final_price,
    ADD COLUMN discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER estimated_price,
    ADD COLUMN admin_note VARCHAR(500) NULL AFTER discount_amount,
    ADD COLUMN negotiated_at TIMESTAMP NULL AFTER admin_note;

UPDATE trip_booking
SET estimated_price = COALESCE(final_price, 0),
    discount_amount = COALESCE(discount_amount, 0)
WHERE estimated_price IS NULL;
