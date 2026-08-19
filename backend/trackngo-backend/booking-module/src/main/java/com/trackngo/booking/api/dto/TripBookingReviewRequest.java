package com.trackngo.booking.api.dto;

import java.math.BigDecimal;

/** Administrator's final decision and negotiated pricing for a private trip. */
public record TripBookingReviewRequest(
        BigDecimal finalPrice,
        BigDecimal discountAmount,
        String adminNote,
        String decision
) {}
