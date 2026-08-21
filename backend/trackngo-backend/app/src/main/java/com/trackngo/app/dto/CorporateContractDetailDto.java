package com.trackngo.app.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/**
 * Full detail view of a single corporate contract: the contract itself, the
 * assigned bus (if any), the company it belongs to and its invoice history.
 */
public record CorporateContractDetailDto(
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
        String finalizedAt,
        BigDecimal billingAmount,
        LocalDate startDate,
        LocalDate endDate,
        String createdAt,
        Long corporateUserId,
        Long busId,
        String companyName,
        String contactPersonName,
        String contactPhone,
        ContractBusDto bus,
        List<ContractBusDto> buses,
        List<CorporateInvoiceDto> invoices,
        BigDecimal totalBilled,
        BigDecimal totalPaid,
        BigDecimal outstandingAmount
) {
}
