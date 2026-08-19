-- ---------------------------------------------------------------------------
-- Development seed: paid driver earnings for demonstration accounts.
--
-- The rows are linked through bus.driver_id -> seat_booking.bus_id and
-- seat_booking.payment_id -> payment.payment_id, so the driver earnings API
-- calculates its response from normal booking and payment data.
--
-- SAFE TO RE-RUN. Rows created by this script use the DRV-EARN-DEMO- and
-- DRV-EARN-PAY- prefixes and are removed before being regenerated.
--
-- Usage: mysql -u root -p trackngo < dev_driver_earnings.sql
-- ---------------------------------------------------------------------------

-- seat_booking.payment_id points at payment, so remove bookings first. The
-- seat mirror is removed through its ON DELETE CASCADE foreign key.
DELETE FROM seat_booking
WHERE booking_reference LIKE 'DRV-EARN-DEMO-%';

DELETE FROM payment
WHERE transaction_id LIKE 'DRV-EARN-PAY-%';

SET @demo_passenger_id = (
    SELECT MIN(passenger_id)
    FROM passenger
    WHERE status = 'active'
);

-- Create two or three completed, paid bookings per assigned bus over the last
-- 28 days. Amounts use the assigned route fee plus a small data-driven daily
-- variation, rather than being displayed as hardcoded earnings in the app.
INSERT INTO seat_booking (
    booking_reference,
    journey_date,
    journey_time,
    seat_number,
    total_amount,
    status,
    created_at,
    passenger_id,
    bus_id,
    route_id,
    payment_id,
    from_stop,
    to_stop
)
WITH RECURSIVE day_offsets AS (
    SELECT 1 AS day_offset
    UNION ALL
    SELECT day_offset + 1
    FROM day_offsets
    WHERE day_offset < 28
),
booking_slots AS (
    SELECT 0 AS slot
    UNION ALL
    SELECT 1
    UNION ALL
    SELECT 2
)
SELECT
    CONCAT(
        'DRV-EARN-DEMO-',
        b.driver_id,
        '-',
        DATE_FORMAT(CURDATE() - INTERVAL d.day_offset DAY, '%Y%m%d'),
        '-',
        s.slot
    ),
    CURDATE() - INTERVAL d.day_offset DAY,
    COALESCE(b.start_time, '06:00:00'),
    CONCAT('Z', b.driver_id, LPAD(d.day_offset, 2, '0'), s.slot),
    COALESCE(r.fee, 450.00) + (MOD(d.day_offset, 4) * 100) + (s.slot * 75),
    'completed',
    TIMESTAMP(
        CURDATE() - INTERVAL (d.day_offset + 2) DAY,
        COALESCE(b.start_time, '06:00:00')
    ),
    @demo_passenger_id,
    b.bus_id,
    r.route_id,
    NULL,
    r.start_location,
    r.end_location
FROM day_offsets d
CROSS JOIN booking_slots s
INNER JOIN bus b
    ON b.driver_id IS NOT NULL
   AND b.status = 'active'
INNER JOIN route r
    ON r.route_id = COALESCE(
        b.route_id,
        (SELECT MIN(route_id) FROM route WHERE is_active = true)
    )
WHERE MOD(d.day_offset + b.driver_id + s.slot, 3) <> 0;

-- Record a successful payment for every generated booking and link it back to
-- the booking. The API uses the booking total only after a successful payment
-- has been established in the payment table.
INSERT INTO payment (
    transaction_id,
    payment_method,
    payment_date,
    payment_status,
    amount
)
SELECT
    CONCAT('DRV-EARN-PAY-', sb.seat_booking_id),
    CASE MOD(sb.seat_booking_id, 3)
        WHEN 0 THEN 'cash'
        WHEN 1 THEN 'payhere'
        ELSE 'stripe'
    END,
    sb.created_at,
    'success',
    sb.total_amount
FROM seat_booking sb
WHERE sb.booking_reference LIKE 'DRV-EARN-DEMO-%';

UPDATE seat_booking sb
INNER JOIN payment p
    ON p.transaction_id = CONCAT('DRV-EARN-PAY-', sb.seat_booking_id)
SET sb.payment_id = p.payment_id
WHERE sb.booking_reference LIKE 'DRV-EARN-DEMO-%';

-- Mirror generated bookings into the seat-level reservation table when the
-- concurrency migration has been applied.
SET @has_seat_table = (
    SELECT COUNT(*)
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = 'seat_booking_seat'
);

SET @mirror_seats = IF(
    @has_seat_table > 0,
    '
        INSERT INTO seat_booking_seat
            (seat_booking_id, bus_id, journey_date, seat_number, created_at)
        SELECT
            sb.seat_booking_id,
            sb.bus_id,
            sb.journey_date,
            sb.seat_number,
            sb.created_at
        FROM seat_booking sb
        WHERE sb.booking_reference LIKE ''DRV-EARN-DEMO-%''
    ',
    'SELECT ''seat_booking_seat not present - skipping seat mirror'' AS note'
);

PREPARE mirror_stmt FROM @mirror_seats;
EXECUTE mirror_stmt;
DEALLOCATE PREPARE mirror_stmt;
