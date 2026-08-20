package com.trackngo.app.service;

import com.trackngo.app.dto.CorporateContractDto;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Standard monthly billing calculation for corporate transport contracts.
 * <p>
 * Mirrors the per-km rate model already used for private trip bookings
 * ({@code TripBookingService}): a small-bus and large-bus per-km rate chosen
 * by headcount, plus the same AC / Mini Bus surcharges, multiplied by the
 * real one-way road distance of each active shift and how many days the
 * service runs per month. Morning and evening routes are priced separately
 * since the evening commute is often not simply the morning route reversed.
 */
@Service
public class CorporatePricingService {

    private static final BigDecimal SMALL_BUS_RATE_PER_KM = new BigDecimal("250");
    private static final BigDecimal LARGE_BUS_RATE_PER_KM = new BigDecimal("400");
    private static final BigDecimal AC_SURCHARGE_MULTIPLIER = new BigDecimal("1.25");
    private static final BigDecimal MINI_BUS_SURCHARGE = new BigDecimal("1500");
    private static final int SMALL_BUS_MAX_EMPLOYEES = 20;

    private static final int WEEKDAYS_PER_MONTH = 22;
    private static final int ALL_DAYS_PER_MONTH = 30;

    /**
     * Computes the standard monthly billing amount for a contract request.
     *
     * @param morningDistanceKm one-way morning route distance; ignored unless the shift includes morning
     * @param eveningDistanceKm one-way evening route distance; ignored unless the shift includes evening
     * @param employeeCount     headcount to transport; determines the bus-size rate tier
     * @param shiftType         "morning", "evening", or "both"
     * @param workingDays       "weekdays" (22 days/month) or "all_days" (30 days/month)
     * @param busType           "standard", "ac" (25% surcharge), or "mini" (flat surcharge per day)
     */
    public BigDecimal calculateMonthlyAmount(
            BigDecimal morningDistanceKm,
            BigDecimal eveningDistanceKm,
            int employeeCount,
            String shiftType,
            String workingDays,
            String busType
    ) {
        if (employeeCount <= 0) {
            throw new IllegalArgumentException("Employee count must be greater than zero.");
        }
        boolean needsMorning = "morning".equalsIgnoreCase(shiftType) || "both".equalsIgnoreCase(shiftType);
        boolean needsEvening = "evening".equalsIgnoreCase(shiftType) || "both".equalsIgnoreCase(shiftType);

        BigDecimal dailyDistanceKm = BigDecimal.ZERO;
        if (needsMorning) {
            dailyDistanceKm = dailyDistanceKm.add(requirePositiveDistance(morningDistanceKm, "morning"));
        }
        if (needsEvening) {
            dailyDistanceKm = dailyDistanceKm.add(requirePositiveDistance(eveningDistanceKm, "evening"));
        }

        BigDecimal ratePerKm = employeeCount <= SMALL_BUS_MAX_EMPLOYEES
                ? SMALL_BUS_RATE_PER_KM
                : LARGE_BUS_RATE_PER_KM;

        BigDecimal dailyCost = dailyDistanceKm.multiply(ratePerKm);
        if ("ac".equalsIgnoreCase(busType)) {
            dailyCost = dailyCost.multiply(AC_SURCHARGE_MULTIPLIER);
        } else if ("mini".equalsIgnoreCase(busType)) {
            dailyCost = dailyCost.add(MINI_BUS_SURCHARGE);
        }

        int daysPerMonth = "all_days".equalsIgnoreCase(workingDays) ? ALL_DAYS_PER_MONTH : WEEKDAYS_PER_MONTH;
        return dailyCost.multiply(BigDecimal.valueOf(daysPerMonth)).setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal requirePositiveDistance(BigDecimal distanceKm, String shiftLabel) {
        if (distanceKm == null || distanceKm.signum() <= 0) {
            throw new IllegalArgumentException("A positive " + shiftLabel + " route distance is required.");
        }
        return distanceKm;
    }

    public BigDecimal calculateMonthlyAmount(CorporateContractDto dto) {
        return calculateMonthlyAmount(
                dto.morningDistanceKm(),
                dto.eveningDistanceKm(),
                dto.employeeCount() == null ? 0 : dto.employeeCount(),
                dto.shiftType(),
                dto.workingDays(),
                dto.busType()
        );
    }
}
