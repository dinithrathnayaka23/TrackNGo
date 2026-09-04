-- The AI assistant can hold seats without taking payment. Those bookings are
-- real reservations - the seats are blocked in seat_booking_seat exactly as a
-- paid booking blocks them - but no money has been collected, so they must not
-- read as 'confirmed' anywhere a paid booking does.
--
-- Before this, the assistant created bookings with status 'confirmed' and a
-- payment row hardcoded to 'success' while never contacting Stripe, which
-- reported a paid ticket for a passenger who had not paid.
-- Nullability and the existing default are preserved exactly; only the
-- permitted value set grows, so no existing row changes.
ALTER TABLE seat_booking
    MODIFY COLUMN status ENUM('reserved', 'confirmed', 'boarded', 'completed', 'cancelled')
    NULL DEFAULT 'confirmed';
