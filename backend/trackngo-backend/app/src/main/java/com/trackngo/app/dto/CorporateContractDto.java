package com.trackngo.app.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

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
        BigDecimal distanceKm,
        String status,
        BigDecimal billingAmount,
        LocalDate startDate,
        LocalDate endDate,
        String createdAt,
        Long corporateUserId,
        Long busId
) {
}
