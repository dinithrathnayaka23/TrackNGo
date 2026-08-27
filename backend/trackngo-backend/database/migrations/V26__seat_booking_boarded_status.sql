-- Widens seat_booking.status to include 'boarded'. BookingFlowService.markPassengerBoarded()
-- (driver "mark as boarded" action), BookingCompletionService, DriverEarningsService, and
-- BookingRepository's disruption-refund query already treat 'boarded' as a real status
-- alongside 'confirmed'/'completed'/'cancelled' — this migration was simply missing, so on
-- any database created from the original seat_booking DDL the driver app's "Mark as Boarded"
-- action fails outright (MySQL rejects the UPDATE because 'boarded' isn't a valid enum value).
ALTER TABLE seat_booking
    MODIFY COLUMN status ENUM('confirmed', 'boarded', 'completed', 'cancelled') DEFAULT 'confirmed';
