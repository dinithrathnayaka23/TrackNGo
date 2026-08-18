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
			COALESCE(recent_payment.payment_status, 'unpaid') AS paymentStatus
		FROM seat_booking sb
		INNER JOIN route r ON r.route_id = sb.route_id
		INNER JOIN bus b ON b.bus_id = sb.bus_id
		INNER JOIN `user` u ON u.user_id = sb.passenger_id
		LEFT JOIN payment recent_payment ON recent_payment.payment_id = sb.payment_id
		WHERE u.email = :email
		  AND sb.status <> 'cancelled'
		  AND sb.journey_date >= CURDATE()
		  AND sb.journey_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
		
		UNION ALL
		
		SELECT
			COALESCE(b.bus_number, 'PENDING') AS busNumber,
			'trip_booking' AS busType,
			CONCAT('BK-', tb.trip_booking_id) AS bookingReference,
			tb.start_location AS startLocation,
			tb.destination AS endLocation,
			tb.start_date AS journeyDate,
			CAST('08:00:00' AS TIME) AS journeyTime,
			COALESCE(trip_payment.payment_status, 'unpaid') AS paymentStatus
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
		  AND tb.start_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
		  
		ORDER BY journeyDate ASC, journeyTime ASC
		LIMIT 8
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
			sb.seat_number AS seatNumber,
			sb.total_amount AS totalAmount,
			sb.status AS status,
			p.transaction_id AS transactionId,
			COALESCE(p.payment_status, 'unpaid') AS paymentStatus
		FROM seat_booking sb
		INNER JOIN bus b ON b.bus_id = sb.bus_id
		INNER JOIN route r ON r.route_id = sb.route_id
		INNER JOIN `user` u ON u.user_id = sb.passenger_id
		LEFT JOIN payment p ON p.payment_id = sb.payment_id
		WHERE u.email = :email
		  AND sb.status <> 'cancelled'
		  AND sb.journey_date >= CURDATE()
		  
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
			COALESCE(trip_payment.payment_status, 'unpaid') AS paymentStatus
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
			sb.seat_number AS seatNumber,
			sb.total_amount AS totalAmount,
			sb.status AS status,
			p.transaction_id AS transactionId,
			COALESCE(p.payment_status, 'unpaid') AS paymentStatus
		FROM seat_booking sb
		INNER JOIN bus b ON b.bus_id = sb.bus_id
		INNER JOIN route r ON r.route_id = sb.route_id
		INNER JOIN `user` u ON u.user_id = sb.passenger_id
		LEFT JOIN payment p ON p.payment_id = sb.payment_id
		WHERE u.email = :email
		  AND (sb.journey_date < CURDATE()
		       OR sb.status = 'cancelled')
		
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
			tb.booking_status AS status,
			COALESCE(trip_payment.transaction_id, 'N/A') AS transactionId,
			COALESCE(trip_payment.payment_status, 'unpaid') AS paymentStatus
		FROM trip_booking tb
		LEFT JOIN bus b ON b.bus_id = tb.bus_id
		LEFT JOIN payment trip_payment ON trip_payment.payment_id = (
			SELECT MAX(latest.payment_id) FROM payment latest
			WHERE latest.trip_booking_id = tb.trip_booking_id
			  AND latest.payment_status = 'success'
		)
		INNER JOIN `user` u ON u.user_id = tb.passenger_id
		WHERE u.email = :email
		  AND (tb.start_date < CURDATE()
		       OR tb.booking_status = 'cancelled')
		       
		ORDER BY journeyDate DESC, journeyTime DESC
		""", nativeQuery = true)
	List<BookingHistoryProjection> findPastByEmail(@Param("email") String email);
}
