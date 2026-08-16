package com.trackngo.booking.api.dto;

import java.time.LocalDate;

/** The passenger's trip request. The server calculates the final fare. */
public record TripBookingRequest(
        String startLocation,
        String destination,
        LocalDate startDate,
        LocalDate returnDate,
        Integer passengerCount,
        String requirement,
        Double distanceKm,
        Double startLatitude,
        Double startLongitude,
        Double destinationLatitude,
        Double destinationLongitude
) {}
