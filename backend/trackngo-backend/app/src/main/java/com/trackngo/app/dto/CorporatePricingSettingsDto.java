package com.trackngo.app.dto;

import java.math.BigDecimal;

/**
 * Admin-configurable rates driving the corporate contract pricing formula.
 * See {@code CorporatePricingService} for how these combine into the
 * monthly billing amount.
 *
 * <p>Pricing model (simplified, Sri Lanka corporate transport):
 * <pre>
 *   ratePerKm = busType=="mini" ? miniBusRatePerKm : standardBusRatePerKm
 *   dailyKm   = morningKm (shiftType=morning) | eveningKm (evening) | both (both)
 *   monthly   = dailyKm × ratePerKm × serviceDaysPerMonth
 *   acSurch   = isAc ? monthly × acSurchargePercent% : 0
 *   subtotal  = monthly + acSurch
 *   platFee   = subtotal × platformFeePercent%
 *   tax       = (subtotal + platFee) × taxPercent%
 *   final     = subtotal + platFee + tax
 * </pre>
 */
public record CorporatePricingSettingsDto(
        BigDecimal standardBusRatePerKm,
        BigDecimal miniBusRatePerKm,
        BigDecimal acSurchargePercent,
        BigDecimal platformFeePercent,
        BigDecimal taxPercent,
        Integer weekdaysPerMonth,
        Integer allDaysPerMonth,
        String updatedAt
) {
}
