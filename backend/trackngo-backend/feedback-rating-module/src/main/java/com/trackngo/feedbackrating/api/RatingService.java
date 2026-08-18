package com.trackngo.feedbackrating.api;

import com.trackngo.feedbackrating.api.dto.RatingContextDto;
import com.trackngo.feedbackrating.api.dto.RatingDto;

public interface RatingService {
    /** Returns the driver/bus/journey to rate for a booking, including any prior submission. */
    RatingContextDto getContext(String email, String bookingReference);

    /** Creates or updates the passenger's rating for a past booking. */
    RatingDto submit(String email, RatingDto dto);
}
