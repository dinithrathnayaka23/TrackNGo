package com.trackngo.feedbackrating.api.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class TripRatingDto {
    private Long id;
    private Integer driverRating;
    private Integer busConditionRating;
    private Integer journeyRating;
    private String reviewText;
    private String image;
    private LocalDateTime createdAt;
    private String passengerName;
    private String busNumber;
}
