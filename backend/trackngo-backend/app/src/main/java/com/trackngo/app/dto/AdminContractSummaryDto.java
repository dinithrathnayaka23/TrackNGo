package com.trackngo.app.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Lean contract row for the admin dashboard's contract list — spans every
 * corporate client, unlike {@link CorporateContractDto} which is scoped to a
 * single corporate user. Full route/leg detail is available via
 * {@code GET /api/corporate/contracts/{contractId}} when more is needed.
 */
public record AdminContractSummaryDto(
        Long contractId,
        String contractName,
        String companyName,
        String contactPersonName,
        String contactPhone,
        String shiftType,
        Integer employeeCount,
        String busType,
        BigDecimal distanceKm,
        String status,
        BigDecimal billingAmount,
        LocalDate startDate,
        LocalDate endDate,
        String createdAt,
        Long corporateUserId,
        Integer busCount,
        BigDecimal advanceAmount,
        String advancePaymentStatus,
        String advancePaidAt
) {
}
