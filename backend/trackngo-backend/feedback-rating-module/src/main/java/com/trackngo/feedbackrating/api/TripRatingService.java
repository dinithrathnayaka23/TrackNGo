package com.trackngo.feedbackrating.api;

import com.trackngo.feedbackrating.api.dto.TripRatingDto;

import java.util.List;

public interface TripRatingService {
    /** Returns the trip ratings left for the given driver, newest first. */
    List<TripRatingDto> getRatingsForDriver(Long driverId);
}
