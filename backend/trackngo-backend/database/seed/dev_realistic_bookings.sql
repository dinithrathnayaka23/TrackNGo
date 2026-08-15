-- ---------------------------------------------------------------------------
-- Development seed: realistic booking activity for the admin analytics page.
--
-- WHY THIS EXISTS
-- The rows in trackngo_sample_data.sql originally omitted seat_booking.created_at,
-- so MySQL applied DEFAULT CURRENT_TIMESTAMP and stamped every booking with the
-- moment the sample file was imported. All bookings therefore shared one calendar
-- day, and any dashboard that groups by creation date showed zeroes for every
-- range that did not happen to contain the import day.
--
-- This script does two things:
--   1. Backdates the ten original sample bookings so each was created a few days
--      before its own journey date.
--   2. Generates ~540 additional bookings spread across the last 180 days, with
--      matching payment rows and seat reservations.
--
-- SAFE TO RE-RUN. Generated rows are tagged with the booking_reference prefix
-- 'SB-DEMO-' and transaction_id prefix 'TXN-DEMO-', and are deleted before being
-- regenerated. Running it twice produces the same result as running it once.
--
-- THIS SCRIPT MAKES NO SCHEMA CHANGES. It only inserts, updates and deletes rows.
-- It is a development/demo convenience and is not part of the migration sequence
-- in ../migrations, which must still be applied in order.
--
-- TO REMOVE ALL GENERATED DATA:
--   DELETE FROM seat_booking WHERE booking_reference LIKE 'SB-DEMO-%';
--   DELETE FROM payment      WHERE transaction_id    LIKE 'TXN-DEMO-%';
--
-- Usage:  mysql -u root -p trackngo < dev_realistic_bookings.sql
-- ---------------------------------------------------------------------------

-- Clear previously generated rows so this script is idempotent.
-- seat_booking_seat rows disappear via ON DELETE CASCADE; payments are removed
-- second because seat_booking.payment_id references them.
DELETE FROM seat_booking WHERE booking_reference LIKE 'SB-DEMO-%';
DELETE FROM payment      WHERE transaction_id    LIKE 'TXN-DEMO-%';

-- ---------------------------------------------------------------------------
-- 1. Give the original sample bookings a believable creation timestamp.
--    A booking is created three days before travel, mid-morning.
-- ---------------------------------------------------------------------------
UPDATE seat_booking
SET created_at = TIMESTAMP(journey_date - INTERVAL 3 DAY, '10:15:00')
WHERE booking_reference LIKE 'SB-2025%';

-- ---------------------------------------------------------------------------
-- 2. Generate 180 days of booking activity, three bookings per day.
--
--    created_at   walks back one day at a time from today
--    journey_date sits 2-5 days after creation, so the most recent bookings are
--                 still upcoming and appear as 'confirmed' rather than 'completed'
--    bus_id       cycles through buses 1-9, covering every bus_type (highway,
--                 long_distance, trip_booking, corporate) so the category
--                 breakdown is populated. Bus 10 is skipped: it is in maintenance.
--    route_id     seat_booking.route_id is NOT NULL, but trip and corporate buses
--                 carry no route of their own, so those fall back to route 1.
--    seat_number  drawn from seat rows F-H, which the original sample data never
--                 uses, so a generated booking cannot collide with an existing
--                 one. Among generated rows, any two sharing a bus and journey
--                 date have different day offsets and therefore different seat
--                 numbers, so uq_active_bus_date_seat (bus_id, journey_date,
--                 seat_number) holds once V2 has been applied.
-- ---------------------------------------------------------------------------
INSERT INTO seat_booking (
    booking_reference, journey_date, journey_time, seat_number, total_amount,
    status, created_at, passenger_id, bus_id, route_id, payment_id,
    from_stop, to_stop
)
WITH RECURSIVE day_offsets AS (
    SELECT 0 AS d
    UNION ALL
    -- 180 days: the 3-month preset compares against the preceding 90 days, so the
    -- data has to reach back twice as far as the longest range the UI offers,
    -- otherwise that comparison divides by an almost-empty window.
    SELECT d + 1 FROM day_offsets WHERE d < 179
),
slots AS (
    SELECT 0 AS s UNION ALL SELECT 1 UNION ALL SELECT 2
),
booking_plan AS (
    SELECT
        d,
        s,
        CURDATE() - INTERVAL d DAY                                AS created_date,
        CURDATE() - INTERVAL d DAY + INTERVAL (2 + (d % 4)) DAY   AS journey_date,
        1 + ((d * 3 + s) % 9)                                     AS bus_id,
        4 + ((d * 2 + s) % 10)                                    AS passenger_id,
        CONCAT('SB-DEMO-', LPAD(d, 3, '0'), '-', s)               AS booking_reference,
        -- Seat rows F-H are reserved for generated data. The original sample
        -- bookings only ever use rows A-E, so a generated booking can never claim
        -- a seat an existing booking already holds, whatever the journey date.
        CONCAT(CHAR(70 + s), 1 + (d % 9))                         AS seat_number
    FROM day_offsets
    CROSS JOIN slots
)
SELECT
    g.booking_reference,
    g.journey_date,
    COALESCE(b.start_time, '06:00:00'),
    g.seat_number,
    -- Fare varies by category and day so revenue is not a flat line.
    CASE b.bus_type
        WHEN 'long_distance' THEN 1600
        WHEN 'corporate'     THEN 2400
        WHEN 'trip_booking'  THEN 3200
        ELSE 450
    END + ((g.d % 7) * 120),
    CASE
        WHEN g.d % 13 = 0                 THEN 'cancelled'
        WHEN g.journey_date < CURDATE()   THEN 'completed'
        ELSE 'confirmed'
    END,
    TIMESTAMP(g.created_date, SEC_TO_TIME(28800 + (g.d * 137 + g.s * 3600) % 36000)),
    g.passenger_id,
    g.bus_id,
    COALESCE(b.route_id, 1),
    NULL,
    COALESCE(r.start_location, 'Colombo Fort'),
    COALESCE(r.end_location, 'Kandy')
FROM booking_plan g
INNER JOIN bus b   ON b.bus_id = g.bus_id
LEFT  JOIN route r ON r.route_id = COALESCE(b.route_id, 1);

-- ---------------------------------------------------------------------------
-- 3. Create a payment for every generated booking that was not cancelled, then
--    link it back. Payment date matches the booking's creation time.
-- ---------------------------------------------------------------------------
INSERT INTO payment (transaction_id, payment_method, payment_date, payment_status, amount)
SELECT
    CONCAT('TXN-DEMO-', sb.seat_booking_id),
    CASE sb.seat_booking_id % 4
        WHEN 0 THEN 'stripe'
        WHEN 1 THEN 'payhere'
        WHEN 2 THEN 'credit_card'
        ELSE 'cash'
    END,
    sb.created_at,
    'success',
    sb.total_amount
FROM seat_booking sb
WHERE sb.booking_reference LIKE 'SB-DEMO-%'
  AND sb.status <> 'cancelled';

UPDATE seat_booking sb
INNER JOIN payment p ON p.transaction_id = CONCAT('TXN-DEMO-', sb.seat_booking_id)
SET sb.payment_id = p.payment_id
WHERE sb.booking_reference LIKE 'SB-DEMO-%';

-- ---------------------------------------------------------------------------
-- 4. Mirror each active booking into seat_booking_seat, the seat-level
--    reservation table that carries the double-booking unique constraint.
--    Cancelled bookings release their seat and are deliberately excluded.
--
--    That table is created by ../migrations/V2__seat_booking_concurrency.sql.
--    Databases where V2 has not been applied yet do not have it, so this step
--    is skipped rather than failing the whole script. Re-run this script after
--    applying V2 and the seat rows will be created.
-- ---------------------------------------------------------------------------
SET @has_seat_table = (
    SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'seat_booking_seat'
);

SET @mirror_seats = IF(@has_seat_table > 0, '
    INSERT INTO seat_booking_seat (seat_booking_id, bus_id, journey_date, seat_number, created_at)
    SELECT sb.seat_booking_id, sb.bus_id, sb.journey_date, sb.seat_number, sb.created_at
    FROM seat_booking sb
    WHERE sb.booking_reference LIKE ''SB-DEMO-%''
      AND sb.status <> ''cancelled''
', 'SELECT ''seat_booking_seat not present - skipping seat mirror'' AS note');

PREPARE mirror_stmt FROM @mirror_seats;
EXECUTE mirror_stmt;
DEALLOCATE PREPARE mirror_stmt;
