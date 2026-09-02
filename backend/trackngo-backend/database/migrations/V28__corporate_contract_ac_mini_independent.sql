-- Splits the corporate contract's bus-pricing category into two independent
-- dimensions: size (standard/mini) and AC (yes/no). The fleet has AC mini
-- buses, so the previous single 3-way bus_type enum ('standard', 'ac',
-- 'mini') couldn't represent that combination. Both surcharges now stack
-- when relevant — see CorporatePricingService.calculateMonthlyAmount.
ALTER TABLE corporate_contract
    ADD COLUMN is_ac BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE corporate_contract SET is_ac = TRUE WHERE bus_type = 'ac';
UPDATE corporate_contract SET bus_type = 'standard' WHERE bus_type = 'ac';

ALTER TABLE corporate_contract
    MODIFY COLUMN bus_type ENUM('standard', 'mini') NOT NULL DEFAULT 'standard';
