package com.trackngo.feedbackrating.internal.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Entity
@Data
@Table(name = "ratings")
public class Rating {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "rating_id")
    private Long id;

    @Column(name = "booking_reference", nullable = false)
    private String bookingReference;

    @Column(name = "passenger_id", nullable = false)
    private Long passengerId;

    @Column(name = "driver_id")
    private Long driverId;

    @Column(name = "bus_id")
    private Long busId;

    @Column(name = "route_id")
    private Long routeId;

    @Column(name = "driver_rating")
    private Integer driverRating;

    @Column(name = "bus_rating")
    private Integer busRating;

    @Column(name = "journey_rating")
    private Integer journeyRating;

    @Column(name = "comment")
    private String comment;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
