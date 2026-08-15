package com.trackngo.booking.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

/** Database-backed booking summary used by the admin booking table. */
public record AdminBookingDto(
        String bookingId,
        String passengerName,
        String route,
        String bus,
        String busType,
        LocalDate journeyDate,
        LocalTime journeyTime,
        String seats,
        BigDecimal amount,
        String paymentStatus,
        String status,
        String category
) {
}
