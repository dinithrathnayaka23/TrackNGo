package com.trackngo.feedbackrating.internal.controller;

import com.trackngo.commons.ApiResponse;
import com.trackngo.feedbackrating.api.TripRatingService;
import com.trackngo.feedbackrating.api.dto.TripRatingDto;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/ratings")
@RequiredArgsConstructor
public class DriverRatingController {
    private final TripRatingService service;

    /** Returns the trip ratings left for the given driver. */
    @GetMapping("/driver/{driverId}")
    @PreAuthorize("hasRole('DRIVER')")
    public ApiResponse<List<TripRatingDto>> getRatingsForDriver(@PathVariable Long driverId) {
        return ApiResponse.ok("Fetched", service.getRatingsForDriver(driverId));
    }
}
