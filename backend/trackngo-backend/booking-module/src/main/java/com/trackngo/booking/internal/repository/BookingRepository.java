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
			r.start_location AS startLocation,
			r.end_location AS endLocation,
			sb.journey_date AS journeyDate,
			sb.journey_time AS journeyTime
		FROM seat_booking sb
		INNER JOIN route r ON r.route_id = sb.route_id
		INNER JOIN bus b ON b.bus_id = sb.bus_id
		INNER JOIN `user` u ON u.user_id = sb.passenger_id
		WHERE u.email = :email
		  AND sb.status <> 'cancelled'
		  AND sb.journey_date >= CURDATE()
		  AND sb.journey_date <= DATE_ADD(CURDATE(), INTERVAL 3 DAY)
		ORDER BY sb.journey_date ASC, sb.journey_time ASC
		LIMIT 8
		""", nativeQuery = true)
	List<RecentBookingProjection> findUpcomingRecentByEmail(@Param("email") String email);

	@Query(value = """
		SELECT
			sb.booking_reference AS bookingReference,
			b.bus_number AS busNumber,
			b.bus_type AS busType,
			r.start_location AS startLocation,
			r.end_location AS endLocation,
			sb.journey_date AS journeyDate,
			sb.journey_time AS journeyTime,
			sb.seat_number AS seatNumber,
			sb.total_amount AS totalAmount,
			sb.status AS status,
			p.transaction_id AS transactionId
		FROM seat_booking sb
		INNER JOIN bus b ON b.bus_id = sb.bus_id
		INNER JOIN route r ON r.route_id = sb.route_id
		INNER JOIN `user` u ON u.user_id = sb.passenger_id
		LEFT JOIN payment p ON p.payment_id = sb.payment_id
		WHERE u.email = :email
		  AND sb.status <> 'cancelled'
		  AND sb.journey_date >= CURDATE()
		ORDER BY sb.journey_date ASC, sb.journey_time ASC
		""", nativeQuery = true)
	List<BookingHistoryProjection> findUpcomingByEmail(@Param("email") String email);

	@Query(value = """
		SELECT
			sb.booking_reference AS bookingReference,
			b.bus_number AS busNumber,
			b.bus_type AS busType,
			r.start_location AS startLocation,
			r.end_location AS endLocation,
			sb.journey_date AS journeyDate,
			sb.journey_time AS journeyTime,
			sb.seat_number AS seatNumber,
			sb.total_amount AS totalAmount,
			sb.status AS status,
			p.transaction_id AS transactionId
		FROM seat_booking sb
		INNER JOIN bus b ON b.bus_id = sb.bus_id
		INNER JOIN route r ON r.route_id = sb.route_id
		INNER JOIN `user` u ON u.user_id = sb.passenger_id
		LEFT JOIN payment p ON p.payment_id = sb.payment_id
		WHERE u.email = :email
		  AND (sb.journey_date < CURDATE()
		       OR sb.status = 'cancelled')
		ORDER BY sb.journey_date DESC, sb.journey_time DESC
		""", nativeQuery = true)
	List<BookingHistoryProjection> findPastByEmail(@Param("email") String email);
}
