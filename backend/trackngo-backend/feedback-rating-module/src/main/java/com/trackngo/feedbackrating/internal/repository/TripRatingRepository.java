package com.trackngo.feedbackrating.internal.repository;

import com.trackngo.feedbackrating.internal.entity.TripRating;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface TripRatingRepository extends JpaRepository<TripRating, Long> {
    /** Returns a driver's trip ratings, newest first, with the reviewer's name and bus number. */
    @Query(value = """
        SELECT
            r.rating_id AS ratingId,
            r.driver_rating AS driverRating,
            r.bus_condition_rating AS busConditionRating,
            r.journey_rating AS journeyRating,
            r.review_text AS reviewText,
            r.image AS image,
            r.created_at AS createdAt,
            u.first_name AS passengerFirstName,
            u.last_name AS passengerLastName,
            b.bus_number AS busNumber
        FROM rating r
        LEFT JOIN `user` u ON u.user_id = r.passenger_id
        LEFT JOIN bus b ON b.bus_id = r.bus_id
        WHERE r.driver_id = :driverId
        ORDER BY r.created_at DESC
        """, nativeQuery = true)
    List<DriverTripRatingView> findRatingsForDriver(@Param("driverId") Long driverId);
}
