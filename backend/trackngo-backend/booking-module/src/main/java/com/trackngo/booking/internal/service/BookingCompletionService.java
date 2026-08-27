package com.trackngo.booking.internal.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Advances bookings to 'completed' once their journey day has fully elapsed.
 *
 * Nothing in the application used to set this status - only the development seed
 * script did - so every real booking stayed 'confirmed' forever. That left past
 * journeys looking active in booking history, and it also meant driver earnings and
 * promotion eligibility, which both filter on status = 'completed', silently ignored
 * every genuine booking.
 *
 * Completion is keyed off the journey date being strictly before today, matching how
 * booking history already defines "past", so a booking becomes past and completed at
 * the same moment. Cancelled bookings are never touched: a cancellation is terminal
 * and stays visible in history as cancelled.
 */
@Service
public class BookingCompletionService {

    private static final Logger log = LoggerFactory.getLogger(BookingCompletionService.class);

    private final JdbcTemplate jdbc;

    public BookingCompletionService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Runs hourly rather than continuously because the boundary it watches only moves
     * once a day. The updates are idempotent, so overlapping runs across instances are
     * harmless.
     */
    @Scheduled(
        initialDelayString = "${trackngo.bookings.completion-initial-delay-ms:15000}",
        fixedDelayString = "${trackngo.bookings.completion-poll-ms:3600000}"
    )
    public void completeElapsedBookings() {
        try {
            int seats = completeElapsedSeatBookings();
            int trips = completeElapsedTripBookings();
            if (seats > 0 || trips > 0) {
                log.info("Marked {} seat booking(s) and {} trip booking(s) as completed", seats, trips);
            }
        } catch (Exception ex) {
            // A failure here must not kill the scheduler; the next run retries.
            log.error("Failed to complete elapsed bookings", ex);
        }
    }

    /** Completes seat bookings that were still live when their journey day passed. */
    int completeElapsedSeatBookings() {
        return jdbc.update("""
                UPDATE seat_booking
                SET status = 'completed'
                WHERE status IN ('confirmed', 'boarded')
                  AND journey_date < CURDATE()
                """);
    }

    /**
     * Completes trip bookings that were accepted before their start date passed.
     * 'pending' is deliberately excluded - a request the driver never accepted was
     * never a journey, so it must not be reported as a completed trip.
     */
    int completeElapsedTripBookings() {
        return jdbc.update("""
                UPDATE trip_booking
                SET booking_status = 'completed'
                WHERE booking_status IN ('approved', 'confirmed', 'in_progress')
                  AND start_date < CURDATE()
                """);
    }
}
