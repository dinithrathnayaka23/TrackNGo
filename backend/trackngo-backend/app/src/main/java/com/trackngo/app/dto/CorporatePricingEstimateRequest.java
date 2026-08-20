package com.trackngo.app.dto;

import java.math.BigDecimal;

public record CorporatePricingEstimateRequest(
        BigDecimal morningDistanceKm,
        BigDecimal eveningDistanceKm,
        Integer employeeCount,
        String shiftType,
        String workingDays,
        String busType
) {
}
