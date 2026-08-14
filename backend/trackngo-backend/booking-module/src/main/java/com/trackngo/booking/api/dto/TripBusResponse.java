package com.trackngo.booking.api.dto;

import java.util.List;

/**
 * Data Transfer Object for buses available for private trip bookings.
 */
public record TripBusResponse(
    Long busId,
    String busNumber,
    String busBrand,
    int seatCapacity,
    List<String> amenities,
    String status
) {}
