-- Admin-configurable rates for the private trip-booking (hire-a-bus) pricing
-- formula, mirroring corporate_pricing_settings so the daily rate, per-km
-- rates, AC/Mini Bus surcharges, and advance-payment percentage can be tuned
-- without a code deploy. Single-row settings table (id is always 1).
CREATE TABLE trip_pricing_settings (
    id TINYINT PRIMARY KEY DEFAULT 1,
    daily_rate DECIMAL(10, 2) NOT NULL DEFAULT 12000.00,
    small_bus_rate_per_km DECIMAL(10, 2) NOT NULL DEFAULT 250.00,
    large_bus_rate_per_km DECIMAL(10, 2) NOT NULL DEFAULT 400.00,
    passenger_threshold INT NOT NULL DEFAULT 20,
    ac_surcharge_percent DECIMAL(5, 2) NOT NULL DEFAULT 25.00,
    mini_bus_surcharge DECIMAL(10, 2) NOT NULL DEFAULT 1500.00,
    advance_payment_percent DECIMAL(5, 2) NOT NULL DEFAULT 15.00,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT chk_trip_pricing_settings_single_row CHECK (id = 1)
);

-- Seed the one settings row with the values the pricing formula already used.
INSERT INTO trip_pricing_settings (id) VALUES (1);
