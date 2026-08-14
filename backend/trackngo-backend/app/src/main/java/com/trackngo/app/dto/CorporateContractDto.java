package com.trackngo.app.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

public record CorporateContractDto(
        Long contractId,
        String contractName,
        String startingLocation,
        String destination,
        LocalTime startShiftTime,
        LocalTime endShiftTime,
        String status,
        BigDecimal billingAmount,
        LocalDate startDate,
        LocalDate endDate,
        String createdAt,
        Long corporateUserId,
        Long busId
) {
}
