-- Reserve every calendar day of an assigned private trip.
-- Run this migration before deploying the trip-booking concurrency changes.

CREATE TABLE IF NOT EXISTS trip_bus_reservation (
    reservation_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    trip_booking_id BIGINT NOT NULL,
    bus_id BIGINT NOT NULL,
    reserved_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_trip_bus_reservation_booking
        FOREIGN KEY (trip_booking_id) REFERENCES trip_booking(trip_booking_id) ON DELETE CASCADE,
    CONSTRAINT fk_trip_bus_reservation_bus
        FOREIGN KEY (bus_id) REFERENCES bus(bus_id) ON DELETE RESTRICT,
    UNIQUE KEY uq_trip_bus_reserved_date (bus_id, reserved_date),
    INDEX idx_trip_bus_reservation_booking (trip_booking_id),
    INDEX idx_trip_bus_reservation_date (bus_id, reserved_date)
) ENGINE=InnoDB;

-- Backfill active assignments. If this insert reports a duplicate-key error,
-- stop and resolve the existing overlapping trip bookings; do not silently
-- choose an owner because that would corrupt the booking records.
INSERT INTO trip_bus_reservation (trip_booking_id, bus_id, reserved_date)
WITH RECURSIVE reservation_dates AS (
    SELECT
        trip_booking_id,
        bus_id,
        start_date AS reserved_date,
        COALESCE(return_date, start_date) AS end_date
    FROM trip_booking
    WHERE bus_id IS NOT NULL
      AND booking_status IN ('pending', 'confirmed', 'in_progress')

    UNION ALL

    SELECT
        trip_booking_id,
        bus_id,
        DATE_ADD(reserved_date, INTERVAL 1 DAY),
        end_date
    FROM reservation_dates
    WHERE reserved_date < end_date
)
SELECT trip_booking_id, bus_id, reserved_date
FROM reservation_dates;
