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
		INNER JOIN passenger p ON p.passenger_id = sb.passenger_id
		INNER JOIN `user` u ON u.user_id = p.passenger_id
		WHERE u.email = :email
		  AND sb.status <> 'cancelled'
		  AND TIMESTAMP(sb.journey_date, sb.journey_time) >= CURRENT_TIMESTAMP()
		ORDER BY sb.journey_date ASC, sb.journey_time ASC
		LIMIT 8
		""", nativeQuery = true)
	List<RecentBookingProjection> findUpcomingRecentByEmail(@Param("email") String email);
}
