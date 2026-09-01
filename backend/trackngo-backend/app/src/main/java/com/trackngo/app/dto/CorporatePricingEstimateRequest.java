package com.trackngo.app.dto;

import java.math.BigDecimal;

/**
 * Request body for the /api/corporate/contracts/estimate endpoint.
 * Mirrors the fields the mobile app collects on the contract creation form.
 */
public record CorporatePricingEstimateRequest(
        BigDecimal morningDistanceKm,
        BigDecimal eveningDistanceKm,
        Integer employeeCount,
        String shiftType,
        String workingDays,
        String busType,
        /** True when the selected bus has AC; drives the AC surcharge. */
        Boolean isAc
) {
}
