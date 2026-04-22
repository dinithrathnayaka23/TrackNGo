package com.trackngo.booking.api.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public final class PromotionDtos {

    private PromotionDtos() {}

    public record PromotionSummary(
            Long promotionId,
            String name,
            String description,
            String targetType,
            String discountType,
            BigDecimal discountValue,
            String promoCode,
            Integer regularCustomerMinCompletedBookings,
            Integer maxBookings,
            Integer usedBookings,
            String status,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {}

    public record SavePromotionRequest(
            String name,
            String description,
            String targetType,
            String discountType,
            BigDecimal discountValue,
            String promoCode,
            Integer regularCustomerMinCompletedBookings,
            Integer maxBookings
    ) {}

    public record PromotionQuoteRequest(
            Long passengerId,
            Long busId,
            String fromLocation,
            String toLocation,
            BigDecimal originalAmount,
            String promoCode
    ) {}

    public record PromotionQuoteResult(
            Long promotionId,
            String name,
            String targetType,
            String discountType,
            BigDecimal discountValue,
            String promoCode,
            BigDecimal originalAmount,
            BigDecimal discountAmount,
            BigDecimal finalAmount,
            String message,
            List<PromotionSummary> eligiblePromotions
    ) {}
}
