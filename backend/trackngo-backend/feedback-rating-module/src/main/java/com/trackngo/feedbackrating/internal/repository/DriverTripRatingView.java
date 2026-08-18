package com.trackngo.feedbackrating.internal.repository;

import java.time.LocalDateTime;

/** Row shape returned when reading a driver's trip ratings, including the reviewer's name. */
public interface DriverTripRatingView {
    Long getRatingId();

    Integer getDriverRating();

    Integer getBusConditionRating();

    Integer getJourneyRating();

    String getReviewText();

    String getImage();

    LocalDateTime getCreatedAt();

    String getPassengerFirstName();

    String getPassengerLastName();

    String getBusNumber();
}
