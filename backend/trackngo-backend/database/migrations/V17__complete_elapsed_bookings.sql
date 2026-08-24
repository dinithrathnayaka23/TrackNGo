-- Backfills bookings whose journey already happened but which were never advanced
-- past 'confirmed'.
--
-- Nothing in the application ever set status = 'completed'; only the development
-- seed script did. Real bookings therefore stayed 'confirmed' forever, which made
-- past journeys look active in booking history and, more seriously, made driver
-- earnings and promotion eligibility ignore them entirely, since both filter on
-- status = 'completed'.
--
-- BookingCompletionService now performs this transition on a schedule, so this
-- migration only repairs the rows that accumulated before it existed. It is
-- idempotent and safe to re-run.
--
-- Cancelled bookings are deliberately left alone: a cancellation is terminal and
-- must stay visible in history as cancelled.

-- Seat bookings: complete anything still live once the journey day has passed.
-- 'boarded' is included because some deployments carry it as an extra enum value;
-- where it is absent the predicate simply matches nothing.
UPDATE seat_booking
SET status = 'completed'
WHERE status IN ('confirmed', 'boarded')
  AND journey_date < CURDATE();

-- Trip bookings: only those the driver actually accepted. A request left 'pending'
-- was never a journey, so completing it would overstate driver earnings.
UPDATE trip_booking
SET booking_status = 'completed'
WHERE booking_status IN ('approved', 'confirmed', 'in_progress')
  AND start_date < CURDATE();

-- Verify nothing elapsed remains outstanding; both counts should be 0.
--
-- SELECT COUNT(*) AS outstanding_seat_bookings
-- FROM seat_booking
-- WHERE status IN ('confirmed', 'boarded') AND journey_date < CURDATE();
--
-- SELECT COUNT(*) AS outstanding_trip_bookings
-- FROM trip_booking
-- WHERE booking_status IN ('approved', 'confirmed', 'in_progress') AND start_date < CURDATE();
