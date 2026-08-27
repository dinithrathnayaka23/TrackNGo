package com.trackngo.app.dto;

import java.math.BigDecimal;

/**
 * discountAmount and adminNote are only used when status transitions to
 * "active" — the admin's one chance to apply a manual discount off the
 * auto-calculated monthly amount, mirroring the discount already supported
 * for trip bookings (see TripBookingReviewRequest).
 */
public record ContractStatusUpdateRequest(String status, BigDecimal discountAmount, String adminNote) {
}
