package com.trackngo.feedbackrating.internal.repository;

import com.trackngo.feedbackrating.internal.entity.TripRating;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface TripRatingRepository extends JpaRepository<TripRating, Long> {
    /**
     * Returns a driver's ratings, newest first, with the reviewer's name and bus number.
     *
     * <p>Ratings live in two tables. The passenger app writes every new rating to
     * "ratings" (see RatingServiceImpl), while "rating" holds the older
     * trip-booking reviews. Reading only the legacy table meant nothing a passenger
     * submitted ever reached the driver's Reviews and Ratings screen, even though the
     * driver's average_rating — and so the home screen and admin web — updated
     * correctly. Both sources are unioned here so old and new reviews appear together.
     *
     * <p>The two tables have independent auto-increment ids, so legacy ids are negated
     * to keep every returned id unique; the driver app uses it as a list key.
     */
    @Query(value = """
        SELECT
            r.rating_id AS ratingId,
            r.driver_rating AS driverRating,
            r.bus_rating AS busConditionRating,
            r.journey_rating AS journeyRating,
            r.comment AS reviewText,
            NULL AS image,
            r.created_at AS createdAt,
            u.first_name AS passengerFirstName,
            u.last_name AS passengerLastName,
            b.bus_number AS busNumber
        FROM ratings r
        LEFT JOIN `user` u ON u.user_id = r.passenger_id
        LEFT JOIN bus b ON b.bus_id = r.bus_id
        WHERE r.driver_id = :driverId

        UNION ALL

        SELECT
            -r.rating_id AS ratingId,
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

        ORDER BY createdAt DESC
        """, nativeQuery = true)
    List<DriverTripRatingView> findRatingsForDriver(@Param("driverId") Long driverId);
}
