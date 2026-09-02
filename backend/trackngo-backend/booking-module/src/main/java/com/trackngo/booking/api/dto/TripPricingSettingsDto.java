package com.trackngo.booking.api.dto;

import java.math.BigDecimal;

/** Admin-configurable rates driving the private trip-booking fare formula. */
public record TripPricingSettingsDto(
        BigDecimal dailyRate,
        BigDecimal smallBusRatePerKm,
        BigDecimal largeBusRatePerKm,
        Integer passengerThreshold,
        BigDecimal acSurchargePercent,
        BigDecimal miniBusSurcharge,
        BigDecimal advancePaymentPercent,
        String updatedAt
) {}
