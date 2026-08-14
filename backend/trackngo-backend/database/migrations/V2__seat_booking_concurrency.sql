-- Run this migration once before deploying the application version that writes
-- seat_booking_seat.  It is intentionally explicit because this project does
-- not currently run Flyway/Liquibase migrations automatically.

CREATE TABLE IF NOT EXISTS seat_booking_seat (
    seat_booking_seat_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    seat_booking_id BIGINT NOT NULL,
    bus_id BIGINT NOT NULL,
    journey_date DATE NOT NULL,
    seat_number VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_seat_booking_seat_booking
        FOREIGN KEY (seat_booking_id) REFERENCES seat_booking(seat_booking_id) ON DELETE CASCADE,
    CONSTRAINT fk_seat_booking_seat_bus
        FOREIGN KEY (bus_id) REFERENCES bus(bus_id) ON DELETE RESTRICT,
    UNIQUE KEY uq_active_bus_date_seat (bus_id, journey_date, seat_number),
    INDEX idx_seat_booking_seat_booking (seat_booking_id),
    INDEX idx_seat_booking_seat_date (bus_id, journey_date)
);

-- Backfill confirmed/completed legacy bookings.  If this insert reports a
-- duplicate-key error, stop the deployment and resolve the existing duplicate
-- seat assignments first; silently choosing an owner would corrupt bookings.
INSERT INTO seat_booking_seat (seat_booking_id, bus_id, journey_date, seat_number)
WITH RECURSIVE seat_tokens AS (
    SELECT
        seat_booking_id,
        bus_id,
        journey_date,
        TRIM(SUBSTRING_INDEX(seat_number, ',', 1)) AS seat_number,
        CASE
            WHEN INSTR(seat_number, ',') > 0
                THEN SUBSTRING(seat_number, INSTR(seat_number, ',') + 1)
            ELSE ''
        END AS remaining
    FROM seat_booking
    WHERE status IN ('confirmed', 'completed')

    UNION ALL

    SELECT
        seat_booking_id,
        bus_id,
        journey_date,
        TRIM(SUBSTRING_INDEX(remaining, ',', 1)) AS seat_number,
        CASE
            WHEN INSTR(remaining, ',') > 0
                THEN SUBSTRING(remaining, INSTR(remaining, ',') + 1)
            ELSE ''
        END AS remaining
    FROM seat_tokens
    WHERE remaining <> ''
)
SELECT seat_booking_id, bus_id, journey_date, UPPER(seat_number)
FROM seat_tokens
WHERE seat_number <> ''
  AND NOT EXISTS (
      SELECT 1
      FROM seat_booking_seat existing
      WHERE existing.bus_id = seat_tokens.bus_id
        AND existing.journey_date = seat_tokens.journey_date
        AND existing.seat_number = UPPER(seat_tokens.seat_number)
  );
