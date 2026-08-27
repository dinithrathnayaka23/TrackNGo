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
        String startingLocation,
        String destination,
        String shiftType,
        Integer employeeCount,
        String busType,
        /** Independent of busType (size) — a bus of either size can also have AC. */
        Boolean isAc,
        BigDecimal distanceKm,
        String status,
        BigDecimal billingAmount,
        LocalDate startDate,
        LocalDate endDate,
        String createdAt,
        Long corporateUserId,
        Integer busCount,
        String busNumbers,
        BigDecimal advanceAmount,
        String advancePaymentStatus,
        String advancePaidAt,
        BigDecimal originalBillingAmount,
        BigDecimal discountAmount,
        ContractCancellationDto cancellation,
        /** "none", "requested", "approved" or "declined" — the corporate client's ask to renew this contract. */
        String renewalRequestStatus
) {
}
