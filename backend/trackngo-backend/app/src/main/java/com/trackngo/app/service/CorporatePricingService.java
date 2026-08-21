package com.trackngo.app.service;

import com.trackngo.app.dto.CorporateContractDto;
import com.trackngo.app.dto.CorporatePricingSettingsDto;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Standard monthly billing calculation for corporate transport contracts.
 * <p>
 * Mirrors the per-km rate model already used for private trip bookings
 * ({@code TripBookingService}): a small-bus and large-bus per-km rate chosen
 * by headcount, plus an AC / Mini Bus surcharge, multiplied by the real
 * one-way road distance of each active shift and how many days the service
 * runs per month. Morning and evening routes are priced separately since the
 * evening commute is often not simply the morning route reversed.
 * <p>
 * All the rates themselves (per-km cost, surcharges, bus-size threshold,
 * days/month) are admin-configurable via {@code corporate_pricing_settings}
 * rather than hardcoded, so operations can tune pricing without a deploy.
 */
@Service
@RequiredArgsConstructor
public class CorporatePricingService {

    private final JdbcTemplate jdbcTemplate;

    private static final String SETTINGS_SQL = """
            SELECT small_bus_rate_per_km, large_bus_rate_per_km, small_bus_max_employees,
                   ac_surcharge_percent, mini_bus_flat_surcharge,
                   weekdays_per_month, all_days_per_month, updated_at
            FROM corporate_pricing_settings
            WHERE id = 1
            """;

    // Fallback values if the settings row is somehow missing, matching the
    // rates this formula originally shipped with.
    private static final CorporatePricingSettingsDto DEFAULT_SETTINGS = new CorporatePricingSettingsDto(
            new BigDecimal("250"), new BigDecimal("400"), 20,
            new BigDecimal("25"), new BigDecimal("1500"), 22, 30, null
    );

    public CorporatePricingSettingsDto getSettings() {
        return jdbcTemplate.query(SETTINGS_SQL, rs -> {
            if (!rs.next()) {
                return DEFAULT_SETTINGS;
            }
            return new CorporatePricingSettingsDto(
                    rs.getBigDecimal("small_bus_rate_per_km"),
                    rs.getBigDecimal("large_bus_rate_per_km"),
                    rs.getInt("small_bus_max_employees"),
                    rs.getBigDecimal("ac_surcharge_percent"),
                    rs.getBigDecimal("mini_bus_flat_surcharge"),
                    rs.getInt("weekdays_per_month"),
                    rs.getInt("all_days_per_month"),
                    rs.getString("updated_at")
            );
        });
    }

    public CorporatePricingSettingsDto updateSettings(CorporatePricingSettingsDto settings) {
        validateSettings(settings);
        jdbcTemplate.update("""
                UPDATE corporate_pricing_settings SET
                    small_bus_rate_per_km = ?, large_bus_rate_per_km = ?, small_bus_max_employees = ?,
                    ac_surcharge_percent = ?, mini_bus_flat_surcharge = ?,
                    weekdays_per_month = ?, all_days_per_month = ?
                WHERE id = 1
                """,
                settings.smallBusRatePerKm(), settings.largeBusRatePerKm(), settings.smallBusMaxEmployees(),
                settings.acSurchargePercent(), settings.miniBusFlatSurcharge(),
                settings.weekdaysPerMonth(), settings.allDaysPerMonth());
        return getSettings();
    }

    private static void validateSettings(CorporatePricingSettingsDto settings) {
        requirePositive(settings.smallBusRatePerKm(), "Small bus rate per km");
        requirePositive(settings.largeBusRatePerKm(), "Large bus rate per km");
        requirePositive(settings.miniBusFlatSurcharge(), "Mini bus flat surcharge");
        if (settings.smallBusMaxEmployees() == null || settings.smallBusMaxEmployees() <= 0) {
            throw new IllegalArgumentException("Small bus max employees must be greater than zero.");
        }
        if (settings.acSurchargePercent() == null || settings.acSurchargePercent().signum() < 0) {
            throw new IllegalArgumentException("AC surcharge percent cannot be negative.");
        }
        if (settings.weekdaysPerMonth() == null || settings.weekdaysPerMonth() <= 0 || settings.weekdaysPerMonth() > 31) {
            throw new IllegalArgumentException("Weekdays per month must be between 1 and 31.");
        }
        if (settings.allDaysPerMonth() == null || settings.allDaysPerMonth() <= 0 || settings.allDaysPerMonth() > 31) {
            throw new IllegalArgumentException("All-days per month must be between 1 and 31.");
        }
    }

    private static void requirePositive(BigDecimal value, String label) {
        if (value == null || value.signum() <= 0) {
            throw new IllegalArgumentException(label + " must be greater than zero.");
        }
    }

    /**
     * Computes the standard monthly billing amount for a contract request.
     *
     * @param morningDistanceKm one-way morning route distance; ignored unless the shift includes morning
     * @param eveningDistanceKm one-way evening route distance; ignored unless the shift includes evening
     * @param employeeCount     headcount to transport; determines the bus-size rate tier
     * @param shiftType         "morning", "evening", or "both"
     * @param workingDays       "weekdays" or "all_days" (day count per month is admin-configured)
     * @param busType           "standard", "ac" (percentage surcharge), or "mini" (flat surcharge per day)
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

        CorporatePricingSettingsDto settings = getSettings();

        BigDecimal ratePerKm = employeeCount <= settings.smallBusMaxEmployees()
                ? settings.smallBusRatePerKm()
                : settings.largeBusRatePerKm();

        BigDecimal dailyCost = dailyDistanceKm.multiply(ratePerKm);
        if ("ac".equalsIgnoreCase(busType)) {
            BigDecimal multiplier = BigDecimal.ONE.add(
                    settings.acSurchargePercent().divide(new BigDecimal("100"), 4, RoundingMode.HALF_UP));
            dailyCost = dailyCost.multiply(multiplier);
        } else if ("mini".equalsIgnoreCase(busType)) {
            dailyCost = dailyCost.add(settings.miniBusFlatSurcharge());
        }

        int daysPerMonth = "all_days".equalsIgnoreCase(workingDays) ? settings.allDaysPerMonth() : settings.weekdaysPerMonth();
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
