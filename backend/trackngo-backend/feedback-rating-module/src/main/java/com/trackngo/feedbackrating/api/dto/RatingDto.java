package com.trackngo.feedbackrating.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class RatingDto {
    private Long id;

    @NotBlank
    private String bookingReference;

    private Long passengerId;
    private Long driverId;
    private Long busId;
    private Long routeId;

    private Integer driverRating;
    private Integer busRating;
    private Integer journeyRating;

    private String comment;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
