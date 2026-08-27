package com.trackngo.booking.internal.repository;

import com.trackngo.booking.internal.entity.Booking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface BookingRepository extends JpaRepository<Booking, Long> {
	@Query(value = """
		SELECT
			b.bus_number AS busNumber,
			b.bus_type AS busType,
			sb.booking_reference AS bookingReference,
			COALESCE(sb.from_stop, r.start_location) AS startLocation,
			COALESCE(sb.to_stop, r.end_location) AS endLocation,
			sb.journey_date AS journeyDate,
			sb.journey_time AS journeyTime,
			COALESCE(MAX(recent_payment.payment_status), 'unpaid') AS paymentStatus,
			sb.status AS status,
			COALESCE(sb.cancellation_status, 'none') AS cancellationStatus,
			sb.cancellation_reason AS cancellationReason,
			sb.cancellation_requested_by AS cancellationRequestedBy,
			sb.cancellation_reject_reason AS cancellationRejectReason,
			sb.refund_percentage AS refundPercentage
		FROM seat_booking sb
		INNER JOIN route r ON r.route_id = sb.route_id
		INNER JOIN bus b ON b.bus_id = sb.bus_id
		INNER JOIN `user` u ON u.user_id = sb.passenger_id
		LEFT JOIN payment recent_payment ON recent_payment.payment_id = sb.payment_id
		WHERE u.email = :email
		  AND sb.status <> 'cancelled'
		  AND sb.journey_date >= CURDATE()
		GROUP BY sb.booking_reference, b.bus_number, b.bus_type, sb.from_stop, r.start_location, sb.to_stop, r.end_location, sb.journey_date, sb.journey_time, sb.status, sb.cancellation_status, sb.cancellation_reason, sb.cancellation_requested_by, sb.cancellation_reject_reason, sb.refund_percentage
		
		UNION ALL
		
		SELECT
			COALESCE(b.bus_number, 'PENDING') AS busNumber,
			'trip_booking' AS busType,
			CONCAT('BK-', tb.trip_booking_id) AS bookingReference,
			tb.start_location AS startLocation,
			tb.destination AS endLocation,
			tb.start_date AS journeyDate,
			CAST('08:00:00' AS TIME) AS journeyTime,
			COALESCE(trip_payment.payment_status, 'unpaid') AS paymentStatus,
			tb.booking_status AS status,
			COALESCE(tb.cancellation_status, 'none') AS cancellationStatus,
			tb.cancellation_reason AS cancellationReason,
			tb.cancellation_requested_by AS cancellationRequestedBy,
			tb.cancellation_reject_reason AS cancellationRejectReason,
			tb.refund_percentage AS refundPercentage
		FROM trip_booking tb
		LEFT JOIN bus b ON b.bus_id = tb.bus_id
		LEFT JOIN payment trip_payment ON trip_payment.payment_id = (
			SELECT MAX(latest.payment_id) FROM payment latest
			WHERE latest.trip_booking_id = tb.trip_booking_id
			  AND latest.payment_status = 'success'
		)
		INNER JOIN `user` u ON u.user_id = tb.passenger_id
		WHERE u.email = :email
		  AND tb.booking_status <> 'cancelled'
		  AND tb.start_date >= CURDATE()
		  AND (tb.booking_status = 'confirmed' OR tb.bus_id IS NOT NULL)
		  
		ORDER BY journeyDate ASC, journeyTime ASC
		LIMIT 15
		""", nativeQuery = true)
	List<RecentBookingProjection> findUpcomingRecentByEmail(@Param("email") String email);

	@Query(value = """
		SELECT
			sb.booking_reference AS bookingReference,
			b.bus_number AS busNumber,
			b.bus_type AS busType,
			COALESCE(sb.from_stop, r.start_location) AS startLocation,
			COALESCE(sb.to_stop, r.end_location) AS endLocation,
			sb.journey_date AS journeyDate,
			sb.journey_time AS journeyTime,
			GROUP_CONCAT(sb.seat_number ORDER BY sb.seat_number SEPARATOR ', ') AS seatNumber,
			SUM(sb.total_amount) AS totalAmount,
			sb.status AS status,
			MAX(p.transaction_id) AS transactionId,
			COALESCE(MAX(p.payment_status), 'unpaid') AS paymentStatus,
			COALESCE(sb.cancellation_status, 'none') AS cancellationStatus,
			sb.cancellation_reason AS cancellationReason,
			sb.cancellation_requested_by AS cancellationRequestedBy,
			sb.cancellation_reject_reason AS cancellationRejectReason,
			sb.refund_percentage AS refundPercentage
		FROM seat_booking sb
		INNER JOIN bus b ON b.bus_id = sb.bus_id
		INNER JOIN route r ON r.route_id = sb.route_id
		INNER JOIN `user` u ON u.user_id = sb.passenger_id
		LEFT JOIN payment p ON p.payment_id = sb.payment_id
		WHERE u.email = :email
		  AND sb.status <> 'cancelled'
		  AND sb.journey_date >= CURDATE()
		GROUP BY sb.booking_reference, b.bus_number, b.bus_type, sb.from_stop, r.start_location, sb.to_stop, r.end_location, sb.journey_date, sb.journey_time, sb.status, sb.cancellation_status, sb.cancellation_reason, sb.cancellation_requested_by, sb.cancellation_reject_reason, sb.refund_percentage
		  
		UNION ALL
		
		SELECT
			CONCAT('BK-', tb.trip_booking_id) AS bookingReference,
			COALESCE(b.bus_number, 'PENDING') AS busNumber,
			'trip_booking' AS busType,
			tb.start_location AS startLocation,
			tb.destination AS endLocation,
			tb.start_date AS journeyDate,
			CAST('08:00:00' AS TIME) AS journeyTime,
			'N/A' AS seatNumber,
			tb.final_price AS totalAmount,
			tb.booking_status AS status,
			COALESCE(trip_payment.transaction_id, 'N/A') AS transactionId,
			COALESCE(trip_payment.payment_status, 'unpaid') AS paymentStatus,
			COALESCE(tb.cancellation_status, 'none') AS cancellationStatus,
			tb.cancellation_reason AS cancellationReason,
			tb.cancellation_requested_by AS cancellationRequestedBy,
			tb.cancellation_reject_reason AS cancellationRejectReason,
			tb.refund_percentage AS refundPercentage
		FROM trip_booking tb
		LEFT JOIN bus b ON b.bus_id = tb.bus_id
		LEFT JOIN payment trip_payment ON trip_payment.payment_id = (
			SELECT MAX(latest.payment_id) FROM payment latest
			WHERE latest.trip_booking_id = tb.trip_booking_id
			  AND latest.payment_status = 'success'
		)
		INNER JOIN `user` u ON u.user_id = tb.passenger_id
		WHERE u.email = :email
		  AND tb.booking_status <> 'cancelled'
		  AND tb.start_date >= CURDATE()
		  AND (tb.booking_status = 'confirmed' OR tb.bus_id IS NOT NULL)
		  
		ORDER BY journeyDate ASC, journeyTime ASC
		""", nativeQuery = true)
	List<BookingHistoryProjection> findUpcomingByEmail(@Param("email") String email);

	@Query(value = """
		SELECT
			sb.booking_reference AS bookingReference,
			b.bus_number AS busNumber,
			b.bus_type AS busType,
			COALESCE(sb.from_stop, r.start_location) AS startLocation,
			COALESCE(sb.to_stop, r.end_location) AS endLocation,
			sb.journey_date AS journeyDate,
			sb.journey_time AS journeyTime,
			GROUP_CONCAT(sb.seat_number ORDER BY sb.seat_number SEPARATOR ', ') AS seatNumber,
			SUM(sb.total_amount) AS totalAmount,
			CASE
				WHEN sb.status IN ('confirmed', 'boarded') AND sb.journey_date < CURDATE()
					THEN 'completed'
				ELSE sb.status
			END AS status,
			MAX(p.transaction_id) AS transactionId,
			COALESCE(MAX(p.payment_status), 'unpaid') AS paymentStatus,
			COALESCE(sb.cancellation_status, 'none') AS cancellationStatus,
			sb.cancellation_reason AS cancellationReason,
			sb.cancellation_requested_by AS cancellationRequestedBy,
			sb.cancellation_reject_reason AS cancellationRejectReason,
			sb.refund_percentage AS refundPercentage
		FROM seat_booking sb
		INNER JOIN bus b ON b.bus_id = sb.bus_id
		INNER JOIN route r ON r.route_id = sb.route_id
		INNER JOIN `user` u ON u.user_id = sb.passenger_id
		LEFT JOIN payment p ON p.payment_id = sb.payment_id
		WHERE u.email = :email
		  AND (sb.status IN ('completed', 'cancelled')
		       OR (sb.status IN ('confirmed', 'boarded') AND sb.journey_date < CURDATE()))
		GROUP BY sb.booking_reference, b.bus_number, b.bus_type, sb.from_stop, r.start_location, sb.to_stop, r.end_location, sb.journey_date, sb.journey_time, sb.status, sb.cancellation_status, sb.cancellation_reason, sb.cancellation_requested_by, sb.cancellation_reject_reason, sb.refund_percentage

		UNION ALL
		
		SELECT
			CONCAT('BK-', tb.trip_booking_id) AS bookingReference,
			COALESCE(b.bus_number, 'N/A') AS busNumber,
			'trip_booking' AS busType,
			tb.start_location AS startLocation,
			tb.destination AS endLocation,
			tb.start_date AS journeyDate,
			CAST('08:00:00' AS TIME) AS journeyTime,
			'N/A' AS seatNumber,
			tb.final_price AS totalAmount,
			CASE
				WHEN tb.booking_status IN ('approved', 'confirmed', 'in_progress')
				     AND tb.start_date < CURDATE()
					THEN 'completed'
				ELSE tb.booking_status
			END AS status,
			COALESCE(trip_payment.transaction_id, 'N/A') AS transactionId,
			COALESCE(trip_payment.payment_status, 'unpaid') AS paymentStatus,
			COALESCE(tb.cancellation_status, 'none') AS cancellationStatus,
			tb.cancellation_reason AS cancellationReason,
			tb.cancellation_requested_by AS cancellationRequestedBy,
			tb.cancellation_reject_reason AS cancellationRejectReason,
			tb.refund_percentage AS refundPercentage
		FROM trip_booking tb
		LEFT JOIN bus b ON b.bus_id = tb.bus_id
		LEFT JOIN payment trip_payment ON trip_payment.payment_id = (
			SELECT MAX(latest.payment_id) FROM payment latest
			WHERE latest.trip_booking_id = tb.trip_booking_id
			  AND latest.payment_status = 'success'
		)
		INNER JOIN `user` u ON u.user_id = tb.passenger_id
		WHERE u.email = :email
		  AND (tb.booking_status IN ('completed', 'cancelled')
		       OR (tb.booking_status IN ('approved', 'confirmed', 'in_progress')
		           AND tb.start_date < CURDATE()))

		ORDER BY journeyDate DESC, journeyTime DESC
		""", nativeQuery = true)
	List<BookingHistoryProjection> findPastByEmail(@Param("email") String email);
}
