package com.trackngo.app.dto;

import java.math.BigDecimal;

/**
 * Admin-configurable rates driving the corporate contract pricing formula.
 * See {@code CorporatePricingService} for how these combine into the
 * monthly billing amount.
 */
public record CorporatePricingSettingsDto(
        BigDecimal smallBusRatePerKm,
        BigDecimal largeBusRatePerKm,
        Integer smallBusMaxEmployees,
        BigDecimal acSurchargePercent,
        BigDecimal miniBusFlatSurcharge,
        Integer weekdaysPerMonth,
        Integer allDaysPerMonth,
        String updatedAt
) {
}
