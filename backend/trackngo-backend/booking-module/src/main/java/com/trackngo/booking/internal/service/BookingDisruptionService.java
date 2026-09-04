package com.trackngo.booking.internal.service;

import com.trackngo.commons.booking.BookingDisruptionHandler;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * Applies the passenger-impacting side effects of a route or bus disruption.
 *
 * Refund rows are deliberately created as PENDING. The current payment flow
 * does not persist a provider refund reference for every gateway, so marking
 * money as refunded before the gateway confirms it would be incorrect.
 */
@Service
public class BookingDisruptionService implements BookingDisruptionHandler {

    private final JdbcTemplate jdbc;
    private final RefundProcessor refundProcessor;

    public BookingDisruptionService(JdbcTemplate jdbc, RefundProcessor refundProcessor) {
        this.jdbc = jdbc;
        this.refundProcessor = refundProcessor;
    }

    @Override
    @Transactional
    public void cancelFutureBookingsForRoute(Long routeId, String reason) {
        cancelFutureBookings("route_id", routeId, reason);
    }

    @Override
    @Transactional
    public void cancelFutureBookingsForBus(Long busId, String reason) {
        cancelFutureBookings("bus_id", busId, reason);
    }

    @Override
    @Transactional
    public void notifyFutureBookingPassengersRouteRestored(Long routeId) {
        notifyRestoredPassengers(
                "route_id",
                routeId,
                "the route was made inactive",
                "The route is active again. Your previous booking remains cancelled and was not reinstated. Please create a new booking if you still want to travel."
        );
    }

    @Override
    @Transactional
    public void notifyFutureBookingPassengersBusRestored(Long busId) {
        notifyRestoredPassengers(
                "bus_id",
                busId,
                "the bus was placed under %",
                "The bus is active again. Your previous booking remains cancelled and was not reinstated. Please create a new booking if you still want to travel."
        );
    }

    private void cancelFutureBookings(String filterColumn, Long filterId, String reason) {
        String selectSql = """
                SELECT sb.seat_booking_id,
                       sb.booking_reference,
                       sb.passenger_id,
                       sb.payment_id,
                       COALESCE(p.amount, sb.total_amount) AS refund_amount
                FROM seat_booking sb
                LEFT JOIN payment p ON p.payment_id = sb.payment_id
                WHERE sb.%s = ?
                  AND sb.status IN ('reserved', 'confirmed')
                  AND sb.journey_date >= CURDATE()
                ORDER BY sb.seat_booking_id
                """.formatted(filterColumn);

        List<Map<String, Object>> bookings = jdbc.queryForList(selectSql, filterId);
        for (Map<String, Object> booking : bookings) {
            Long bookingId = number(booking.get("seat_booking_id"));
            String bookingReference = (String) booking.get("booking_reference");
            Long passengerId = number(booking.get("passenger_id"));
            Long paymentId = number(booking.get("payment_id"));
            BigDecimal refundAmount = (BigDecimal) booking.get("refund_amount");

            int cancelled = jdbc.update(
                    "UPDATE seat_booking SET status = 'cancelled', cancellation_reason = ? " +
                    "WHERE seat_booking_id = ? AND status IN ('reserved', 'confirmed') AND journey_date >= CURDATE()",
                    reason,
                    bookingId
            );
            if (cancelled == 0) {
                continue;
            }

            jdbc.update("DELETE FROM seat_booking_seat WHERE seat_booking_id = ?", bookingId);

            String disruptionKey = "DISRUPTION:" + bookingReference;
            if (paymentId != null) {
                jdbc.update("""
                        INSERT INTO refund
                            (refund_reason, refund_status, refund_amount, disruption_key, payment_id)
                        SELECT ?, 'pending', ?, ?, ?
                        WHERE NOT EXISTS (
                            SELECT 1 FROM refund WHERE disruption_key = ?
                        )
                        """,
                        reason,
                        refundAmount,
                        disruptionKey,
                        paymentId,
                        disruptionKey
                );
            }

            String paymentMessage = paymentId == null
                    ? " No payment record was attached; no refund is required."
                    : " A refund request for LKR " + refundAmount +
                      " has been created and is awaiting payment-provider confirmation.";
            jdbc.update(
                    "INSERT INTO notification " +
                    "(notification_type, title, message, passenger_id) VALUES ('cancellation', ?, ?, ?)",
                    "Booking cancelled by TrackNGo",
                    "Booking " + bookingReference + " was cancelled because " + reason + "." + paymentMessage,
                    passengerId
            );
        }

        processRefundsAfterCommit();
    }

    private void processRefundsAfterCommit() {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            return;
        }

        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                refundProcessor.processPendingStripeRefunds();
            }
        });
    }

    private void notifyRestoredPassengers(
            String filterColumn,
            Long filterId,
            String cancellationReason,
            String message
    ) {
        String reasonOperator = cancellationReason.contains("%") ? "LIKE" : "=";
        String selectSql = """
                SELECT seat_booking_id, booking_reference, passenger_id
                FROM seat_booking
                WHERE %s = ?
                  AND status = 'cancelled'
                  AND journey_date >= CURDATE()
                  AND cancellation_reason %s ?
                  AND restoration_notified_at IS NULL
                ORDER BY seat_booking_id
                """.formatted(filterColumn, reasonOperator);

        List<Map<String, Object>> bookings = jdbc.queryForList(selectSql, filterId, cancellationReason);
        for (Map<String, Object> booking : bookings) {
            Long bookingId = number(booking.get("seat_booking_id"));
            String bookingReference = (String) booking.get("booking_reference");
            Long passengerId = number(booking.get("passenger_id"));

            int marked = jdbc.update(
                    "UPDATE seat_booking SET restoration_notified_at = CURRENT_TIMESTAMP " +
                    "WHERE seat_booking_id = ? AND restoration_notified_at IS NULL",
                    bookingId
            );
            if (marked == 0) {
                continue;
            }

            jdbc.update(
                    "INSERT INTO notification " +
                    "(notification_type, title, message, passenger_id) VALUES ('journey', ?, ?, ?)",
                    "Service restored",
                    "Booking " + bookingReference + ": " + message,
                    passengerId
            );
        }
    }

    private Long number(Object value) {
        return value == null ? null : ((Number) value).longValue();
    }
}
