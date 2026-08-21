-- Admin-configurable rates for the corporate contract pricing formula, so
-- the per-km rate, AC/Mini Bus surcharges, and working-day counts can be
-- tuned without a code deploy. Single-row settings table (id is always 1).
CREATE TABLE corporate_pricing_settings (
    id TINYINT PRIMARY KEY DEFAULT 1,
    small_bus_rate_per_km DECIMAL(10, 2) NOT NULL DEFAULT 250.00,
    large_bus_rate_per_km DECIMAL(10, 2) NOT NULL DEFAULT 400.00,
    small_bus_max_employees INT NOT NULL DEFAULT 20,
    ac_surcharge_percent DECIMAL(5, 2) NOT NULL DEFAULT 25.00,
    mini_bus_flat_surcharge DECIMAL(10, 2) NOT NULL DEFAULT 1500.00,
    weekdays_per_month INT NOT NULL DEFAULT 22,
    all_days_per_month INT NOT NULL DEFAULT 30,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT chk_corporate_pricing_settings_single_row CHECK (id = 1)
);

-- Seed the one settings row with the values the pricing formula already used.
INSERT INTO corporate_pricing_settings (id) VALUES (1);
