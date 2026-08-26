-- Adds morning/evening shift scheduling and standard pricing inputs to corporate
-- contracts. Corporate clients can now request a morning-only, evening-only, or
-- both-shift transport service, with a separate pickup/drop-off route per shift
-- (the evening commute is often not just the morning route reversed), and
-- billing is calculated server-side from real road distance + shift count
-- instead of being entered ad hoc by the mobile client.
-- start_shift_time / end_shift_time already exist (TIME NOT NULL) and are kept
-- as a legacy "earliest pickup / latest drop-off of the day" summary, derived
-- from whichever shift-specific times are set below.
ALTER TABLE corporate_contract
    ADD COLUMN shift_type ENUM('morning', 'evening', 'both') NOT NULL DEFAULT 'both' AFTER destination,

    ADD COLUMN morning_pickup_location VARCHAR(255) NULL AFTER shift_type,
    ADD COLUMN morning_pickup_lat DECIMAL(10, 7) NULL AFTER morning_pickup_location,
    ADD COLUMN morning_pickup_lng DECIMAL(10, 7) NULL AFTER morning_pickup_lat,
    ADD COLUMN morning_pickup_time TIME NULL AFTER morning_pickup_lng,
    ADD COLUMN morning_dropoff_location VARCHAR(255) NULL AFTER morning_pickup_time,
    ADD COLUMN morning_dropoff_lat DECIMAL(10, 7) NULL AFTER morning_dropoff_location,
    ADD COLUMN morning_dropoff_lng DECIMAL(10, 7) NULL AFTER morning_dropoff_lat,
    ADD COLUMN morning_dropoff_time TIME NULL AFTER morning_dropoff_lng,
    ADD COLUMN morning_distance_km DECIMAL(6, 2) NULL AFTER morning_dropoff_time,

    ADD COLUMN evening_pickup_location VARCHAR(255) NULL AFTER morning_distance_km,
    ADD COLUMN evening_pickup_lat DECIMAL(10, 7) NULL AFTER evening_pickup_location,
    ADD COLUMN evening_pickup_lng DECIMAL(10, 7) NULL AFTER evening_pickup_lat,
    ADD COLUMN evening_pickup_time TIME NULL AFTER evening_pickup_lng,
    ADD COLUMN evening_dropoff_location VARCHAR(255) NULL AFTER evening_pickup_time,
    ADD COLUMN evening_dropoff_lat DECIMAL(10, 7) NULL AFTER evening_dropoff_location,
    ADD COLUMN evening_dropoff_lng DECIMAL(10, 7) NULL AFTER evening_dropoff_lat,
    ADD COLUMN evening_dropoff_time TIME NULL AFTER evening_dropoff_lng,
    ADD COLUMN evening_distance_km DECIMAL(6, 2) NULL AFTER evening_dropoff_time,

    ADD COLUMN employee_count INT NOT NULL DEFAULT 0 AFTER evening_distance_km,
    ADD COLUMN working_days ENUM('weekdays', 'all_days') NOT NULL DEFAULT 'weekdays' AFTER employee_count,
    ADD COLUMN bus_type ENUM('standard', 'ac', 'mini') NOT NULL DEFAULT 'standard' AFTER working_days,
    ADD COLUMN distance_km DECIMAL(6, 2) NULL AFTER bus_type;

-- Backfill existing rows: treat the legacy single start/end shift window and
-- starting_location/destination pair as a "both" shift whose morning route is
-- the original trip and whose evening route is the same trip reversed, so
-- historical contracts keep meaningful values under the new columns.
UPDATE corporate_contract
SET morning_pickup_location = starting_location,
    morning_dropoff_location = destination,
    morning_pickup_time = start_shift_time,
    morning_dropoff_time = start_shift_time,
    evening_pickup_location = destination,
    evening_dropoff_location = starting_location,
    evening_pickup_time = end_shift_time,
    evening_dropoff_time = end_shift_time
WHERE morning_pickup_location IS NULL;
