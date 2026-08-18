package com.trackngo.feedbackrating.api.dto;

import lombok.Data;

import java.time.LocalDate;

/**
 * Describes the driver/bus/journey a passenger is about to rate, plus any rating they already
 * submitted for that booking so the mobile app can pre-fill and let them edit it.
 */
@Data
public class RatingContextDto {
    private String bookingReference;
    private String startLocation;
    private String endLocation;
    private LocalDate journeyDate;
    private String busNumber;
    private String busType;
    private Long driverId;
    private String driverName;
    private Long busId;

    private boolean alreadyRated;
    private Integer driverRating;
    private Integer busRating;
    private Integer journeyRating;
    private String comment;
}
