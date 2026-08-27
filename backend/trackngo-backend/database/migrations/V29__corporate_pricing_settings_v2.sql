-- Replaces the old headcount-driven small/large bus rate model with a simpler
-- two-bus-type model (Standard Bus / Mini Rosa), each with its own per-km rate.
-- AC is now an independent boolean surcharge (already on corporate_contract via V28).
-- Adds platform/service fee and tax percentages for the final price calculation.
-- Removes: small_bus_rate_per_km, large_bus_rate_per_km, small_bus_max_employees,
--          mini_bus_flat_surcharge (replaced by mini_bus_rate_per_km).
-- Keeps:   ac_surcharge_percent, weekdays_per_month, all_days_per_month.

ALTER TABLE corporate_pricing_settings
    ADD COLUMN standard_bus_rate_per_km DECIMAL(10,2) NOT NULL DEFAULT 250.00,
    ADD COLUMN mini_bus_rate_per_km     DECIMAL(10,2) NOT NULL DEFAULT 200.00,
    ADD COLUMN platform_fee_percent     DECIMAL(5,2)  NOT NULL DEFAULT 5.00,
    ADD COLUMN tax_percent              DECIMAL(5,2)  NOT NULL DEFAULT 0.00;

-- Seed new columns from existing data where possible
UPDATE corporate_pricing_settings
SET standard_bus_rate_per_km = COALESCE(large_bus_rate_per_km, 250.00),
    mini_bus_rate_per_km     = COALESCE(small_bus_rate_per_km, 200.00)
WHERE id = 1;

-- Drop superseded columns
ALTER TABLE corporate_pricing_settings
    DROP COLUMN small_bus_rate_per_km,
    DROP COLUMN large_bus_rate_per_km,
    DROP COLUMN small_bus_max_employees,
    DROP COLUMN mini_bus_flat_surcharge;
