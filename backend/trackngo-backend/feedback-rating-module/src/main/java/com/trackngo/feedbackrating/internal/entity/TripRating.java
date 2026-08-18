package com.trackngo.feedbackrating.internal.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;

import java.time.LocalDateTime;

/** A passenger's rating of a completed trip, sourced from the "rating" table. */
@Entity
@Data
@Table(name = "rating")
public class TripRating {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "rating_id")
    private Long id;

    @Column(name = "driver_rating")
    private Integer driverRating;

    @Column(name = "bus_condition_rating")
    private Integer busConditionRating;

    @Column(name = "journey_rating")
    private Integer journeyRating;

    @Column(name = "review_text")
    private String reviewText;

    @Column(name = "image")
    private String image;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "trip_booking_id")
    private Long tripBookingId;

    @Column(name = "passenger_id", nullable = false)
    private Long passengerId;

    @Column(name = "bus_id", nullable = false)
    private Long busId;

    @Column(name = "driver_id", nullable = false)
    private Long driverId;
}
