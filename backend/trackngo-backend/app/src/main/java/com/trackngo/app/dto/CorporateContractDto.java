package com.trackngo.app.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public record CorporateContractDto(
        Long contractId,
        String contractName,
        String startingLocation,
        String destination,
        String shiftType,
        LocalTime startShiftTime,
        LocalTime endShiftTime,
        ShiftLegDto morningPickup,
        ShiftLegDto morningDropoff,
        BigDecimal morningDistanceKm,
        ShiftLegDto eveningPickup,
        ShiftLegDto eveningDropoff,
        BigDecimal eveningDistanceKm,
        Integer employeeCount,
        String workingDays,
        String busType,
        /** Independent of busType (size) — a bus of either size can also have AC. */
        Boolean isAc,
        BigDecimal distanceKm,
        String status,
        String finalizedAt,
        BigDecimal billingAmount,
        LocalDate startDate,
        LocalDate endDate,
        String createdAt,
        Long corporateUserId,
        Long busId,
        List<Long> busIds,
        BigDecimal advanceAmount,
        String advancePaymentStatus,
        String advancePaidAt,
        BigDecimal originalBillingAmount,
        BigDecimal discountAmount,
        BigDecimal carriedBalance,
        ContractCancellationDto cancellation,
        /** Write-only: set on create to tag a new contract as a renewal of this prior one. Never read back. */
        Long renewedFromContractId,
        /** "none", "requested", "approved" or "declined" — the corporate client's ask to renew this contract. */
        String renewalRequestStatus
) {
}
