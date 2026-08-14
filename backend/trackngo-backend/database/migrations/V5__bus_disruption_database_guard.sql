-- Database-level safety net for every bus status writer, including admin tools
-- or older application instances that bypass BookingDisruptionService.

DROP TRIGGER IF EXISTS trg_bus_disruption_guard;

DELIMITER $$

CREATE TRIGGER trg_bus_disruption_guard
AFTER UPDATE ON bus
FOR EACH ROW
BEGIN
    DECLARE disruption_reason TEXT;

    IF LOWER(COALESCE(NEW.status, '')) IN ('maintenance', 'inactive') THEN
        SET disruption_reason = CONCAT('the bus was placed under ', LOWER(NEW.status));

        UPDATE seat_booking
        SET status = 'cancelled',
            cancellation_reason = disruption_reason
        WHERE bus_id = NEW.bus_id
          AND status = 'confirmed'
          AND journey_date >= CURDATE();

        DELETE sbs
        FROM seat_booking_seat sbs
        INNER JOIN seat_booking sb ON sb.seat_booking_id = sbs.seat_booking_id
        WHERE sb.bus_id = NEW.bus_id
          AND sb.status = 'cancelled'
          AND sb.journey_date >= CURDATE();

        INSERT INTO refund
            (refund_reason, refund_status, refund_amount, disruption_key, payment_id)
        SELECT disruption_reason,
               'pending',
               COALESCE(p.amount, sb.total_amount),
               CONCAT('DISRUPTION:', sb.booking_reference),
               sb.payment_id
        FROM seat_booking sb
        LEFT JOIN payment p ON p.payment_id = sb.payment_id
        WHERE sb.bus_id = NEW.bus_id
          AND sb.status = 'cancelled'
          AND sb.cancellation_reason = disruption_reason
          AND sb.journey_date >= CURDATE()
          AND sb.payment_id IS NOT NULL
        ON DUPLICATE KEY UPDATE disruption_key = VALUES(disruption_key);

        INSERT INTO notification
            (notification_type, title, message, passenger_id)
        SELECT
            'cancellation',
            'Booking cancelled by TrackNGo',
            CONCAT(
                'Booking ', sb.booking_reference,
                ' was cancelled because ', disruption_reason, '.',
                CASE WHEN sb.payment_id IS NULL
                    THEN ' No payment record was attached; no refund is required.'
                    ELSE CONCAT(
                        ' A refund request for LKR ', COALESCE(p.amount, sb.total_amount),
                        ' has been created and is awaiting payment-provider confirmation.'
                    )
                END
            ),
            sb.passenger_id
        FROM seat_booking sb
        LEFT JOIN payment p ON p.payment_id = sb.payment_id
        WHERE sb.bus_id = NEW.bus_id
          AND sb.status = 'cancelled'
          AND sb.cancellation_reason = disruption_reason
          AND sb.journey_date >= CURDATE()
          AND NOT EXISTS (
              SELECT 1
              FROM notification n
              WHERE n.passenger_id = sb.passenger_id
                AND n.notification_type = 'cancellation'
                AND n.title = 'Booking cancelled by TrackNGo'
                AND n.message = CONCAT(
                    'Booking ', sb.booking_reference,
                    ' was cancelled because ', disruption_reason, '.',
                    CASE WHEN sb.payment_id IS NULL
                        THEN ' No payment record was attached; no refund is required.'
                        ELSE CONCAT(
                            ' A refund request for LKR ', COALESCE(p.amount, sb.total_amount),
                            ' has been created and is awaiting payment-provider confirmation.'
                    )
                    END
                )
          );
    END IF;

    IF LOWER(COALESCE(OLD.status, '')) IN ('maintenance', 'inactive')
       AND LOWER(COALESCE(NEW.status, '')) = 'active' THEN
        UPDATE seat_booking
        SET restoration_notified_at = CURRENT_TIMESTAMP
        WHERE bus_id = NEW.bus_id
          AND status = 'cancelled'
          AND journey_date >= CURDATE()
          AND cancellation_reason LIKE 'the bus was placed under %'
          AND restoration_notified_at IS NULL;

        INSERT INTO notification
            (notification_type, title, message, passenger_id)
        SELECT
            'journey',
            'Service restored',
            CONCAT(
                'Booking ', sb.booking_reference,
                ': The bus is active again. Your previous booking remains cancelled '
                'and was not reinstated. Please create a new booking if you still want to travel.'
            ),
            sb.passenger_id
        FROM seat_booking sb
        WHERE sb.bus_id = NEW.bus_id
          AND sb.status = 'cancelled'
          AND sb.journey_date >= CURDATE()
          AND sb.cancellation_reason LIKE 'the bus was placed under %'
          AND sb.restoration_notified_at IS NOT NULL
          AND NOT EXISTS (
              SELECT 1
              FROM notification n
              WHERE n.passenger_id = sb.passenger_id
                AND n.notification_type = 'journey'
                AND n.title = 'Service restored'
                AND n.message LIKE CONCAT('Booking ', sb.booking_reference, ':%')
          );
    END IF;
END$$

DELIMITER ;

-- Repair bookings left confirmed while their bus was already unavailable.
UPDATE seat_booking sb
INNER JOIN bus b ON b.bus_id = sb.bus_id
SET sb.status = 'cancelled',
    sb.cancellation_reason = CONCAT('the bus was placed under ', LOWER(b.status))
WHERE LOWER(b.status) IN ('maintenance', 'inactive')
  AND sb.status = 'confirmed'
  AND sb.journey_date >= CURDATE();

DELETE sbs
FROM seat_booking_seat sbs
INNER JOIN seat_booking sb ON sb.seat_booking_id = sbs.seat_booking_id
INNER JOIN bus b ON b.bus_id = sb.bus_id
WHERE LOWER(b.status) IN ('maintenance', 'inactive')
  AND sb.status = 'cancelled'
  AND sb.journey_date >= CURDATE();

INSERT INTO refund
    (refund_reason, refund_status, refund_amount, disruption_key, payment_id)
SELECT sb.cancellation_reason,
       'pending',
       COALESCE(p.amount, sb.total_amount),
       CONCAT('DISRUPTION:', sb.booking_reference),
       sb.payment_id
FROM seat_booking sb
LEFT JOIN payment p ON p.payment_id = sb.payment_id
INNER JOIN bus b ON b.bus_id = sb.bus_id
WHERE LOWER(b.status) IN ('maintenance', 'inactive')
  AND sb.status = 'cancelled'
  AND sb.cancellation_reason LIKE 'the bus was placed under %'
  AND sb.journey_date >= CURDATE()
  AND sb.payment_id IS NOT NULL
ON DUPLICATE KEY UPDATE disruption_key = VALUES(disruption_key);

INSERT INTO notification
    (notification_type, title, message, passenger_id)
SELECT
    'cancellation',
    'Booking cancelled by TrackNGo',
    CONCAT(
        'Booking ', sb.booking_reference,
        ' was cancelled because ', sb.cancellation_reason, '.',
        CASE WHEN sb.payment_id IS NULL
            THEN ' No payment record was attached; no refund is required.'
            ELSE CONCAT(
                ' A refund request for LKR ', COALESCE(p.amount, sb.total_amount),
                ' has been created and is awaiting payment-provider confirmation.'
        )
        END
    ),
    sb.passenger_id
FROM seat_booking sb
LEFT JOIN payment p ON p.payment_id = sb.payment_id
INNER JOIN bus b ON b.bus_id = sb.bus_id
WHERE LOWER(b.status) IN ('maintenance', 'inactive')
  AND sb.status = 'cancelled'
  AND sb.cancellation_reason LIKE 'the bus was placed under %'
  AND sb.journey_date >= CURDATE()
  AND NOT EXISTS (
      SELECT 1
      FROM notification n
      WHERE n.passenger_id = sb.passenger_id
        AND n.notification_type = 'cancellation'
        AND n.title = 'Booking cancelled by TrackNGo'
        AND n.message LIKE CONCAT('Booking ', sb.booking_reference, ':%')
  );
