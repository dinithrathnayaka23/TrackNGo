package com.trackngo.app.service;

import com.trackngo.app.dto.ContractBusDto;
import com.trackngo.app.dto.CorporateContractDto;
import com.trackngo.app.dto.CorporatePricingSettingsDto;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/**
 * Simple, realistic pricing engine for corporate employee transport contracts
 * in Sri Lanka.
 *
 * <h3>Formula</h3>
 * <pre>
 *   // For each assigned bus:
 *   ratePerKm = isMiniRosa ? miniBusRatePerKm : standardBusRatePerKm
 *   busTransportCost = dailyKm × ratePerKm × serviceDays
 *   busAcSurcharge   = isAc ? busTransportCost × acSurchargePercent/100 : 0
 *   busTotal         = busTransportCost + busAcSurcharge
 *
 *   // Total across all assigned buses:
 *   subtotal    = sum(busTotal across all assigned buses)
 *   platformFee = subtotal × platformFeePercent/100
 *   tax         = (subtotal + platformFee) × taxPercent/100
 *   final       = subtotal + platformFee + tax
 * </pre>
 */
@Service
@RequiredArgsConstructor
public class CorporatePricingService {

    private final JdbcTemplate jdbcTemplate;

    private static final String SETTINGS_SQL = """
            SELECT standard_bus_rate_per_km, mini_bus_rate_per_km,
                   ac_surcharge_percent, platform_fee_percent, tax_percent,
                   weekdays_per_month, all_days_per_month, updated_at
            FROM corporate_pricing_settings
            WHERE id = 1
            """;

    /** Fallback when the settings row is somehow absent. */
    private static final CorporatePricingSettingsDto DEFAULT_SETTINGS = new CorporatePricingSettingsDto(
            new BigDecimal("250.00"), // standardBusRatePerKm
            new BigDecimal("200.00"), // miniBusRatePerKm
            new BigDecimal("25.00"),  // acSurchargePercent
            new BigDecimal("5.00"),   // platformFeePercent
            new BigDecimal("0.00"),   // taxPercent
            22, 30, null
    );

    public CorporatePricingSettingsDto getSettings() {
        return jdbcTemplate.query(SETTINGS_SQL, rs -> {
            if (!rs.next()) {
                return DEFAULT_SETTINGS;
            }
            return new CorporatePricingSettingsDto(
                    rs.getBigDecimal("standard_bus_rate_per_km"),
                    rs.getBigDecimal("mini_bus_rate_per_km"),
                    rs.getBigDecimal("ac_surcharge_percent"),
                    rs.getBigDecimal("platform_fee_percent"),
                    rs.getBigDecimal("tax_percent"),
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
                    standard_bus_rate_per_km = ?, mini_bus_rate_per_km = ?,
                    ac_surcharge_percent = ?, platform_fee_percent = ?, tax_percent = ?,
                    weekdays_per_month = ?, all_days_per_month = ?
                WHERE id = 1
                """,
                settings.standardBusRatePerKm(), settings.miniBusRatePerKm(),
                settings.acSurchargePercent(), settings.platformFeePercent(), settings.taxPercent(),
                settings.weekdaysPerMonth(), settings.allDaysPerMonth());
        return getSettings();
    }

    private static void validateSettings(CorporatePricingSettingsDto s) {
        requirePositive(s.standardBusRatePerKm(), "Standard bus rate per km");
        requirePositive(s.miniBusRatePerKm(), "Mini Rosa bus rate per km");
        requireNonNegative(s.acSurchargePercent(), "AC surcharge percent");
        requireNonNegative(s.platformFeePercent(), "Platform fee percent");
        requireNonNegative(s.taxPercent(), "Tax percent");
        if (s.weekdaysPerMonth() == null || s.weekdaysPerMonth() <= 0 || s.weekdaysPerMonth() > 31) {
            throw new IllegalArgumentException("Weekdays per month must be between 1 and 31.");
        }
        if (s.allDaysPerMonth() == null || s.allDaysPerMonth() <= 0 || s.allDaysPerMonth() > 31) {
            throw new IllegalArgumentException("All-days per month must be between 1 and 31.");
        }
    }

    private static void requirePositive(BigDecimal value, String label) {
        if (value == null || value.signum() <= 0) {
            throw new IllegalArgumentException(label + " must be greater than zero.");
        }
    }

    private static void requireNonNegative(BigDecimal value, String label) {
        if (value == null || value.signum() < 0) {
            throw new IllegalArgumentException(label + " cannot be negative.");
        }
    }

    /**
     * Computes the final monthly billing amount for a contract with multiple assigned buses.
     * Each bus is priced according to its individual type (Standard vs Mini Rosa) and AC capability.
     */
    public BigDecimal calculateMonthlyAmount(
            BigDecimal morningDistanceKm,
            BigDecimal eveningDistanceKm,
            String shiftType,
            String workingDays,
            List<ContractBusDto> assignedBuses
    ) {
        if (assignedBuses == null || assignedBuses.isEmpty()) {
            return calculateMonthlyAmount(morningDistanceKm, eveningDistanceKm, shiftType, workingDays, "standard", false);
        }

        CorporatePricingSettingsDto s = getSettings();
        BigDecimal dailyKm = calculateDailyDistance(morningDistanceKm, eveningDistanceKm, shiftType);
        int serviceDays = "all_days".equalsIgnoreCase(workingDays) ? s.allDaysPerMonth() : s.weekdaysPerMonth();

        BigDecimal subtotal = BigDecimal.ZERO;
        for (ContractBusDto bus : assignedBuses) {
            boolean isMini = bus.busBrand() != null && bus.busBrand().toLowerCase().contains("rosa");
            boolean isAc = bus.amenities() != null && bus.amenities().toLowerCase().contains("ac");

            BigDecimal ratePerKm = isMini ? s.miniBusRatePerKm() : s.standardBusRatePerKm();
            BigDecimal busTransportCost = dailyKm.multiply(ratePerKm).multiply(BigDecimal.valueOf(serviceDays));

            BigDecimal busAcSurcharge = BigDecimal.ZERO;
            if (isAc && s.acSurchargePercent().signum() > 0) {
                busAcSurcharge = busTransportCost.multiply(
                        s.acSurchargePercent().divide(new BigDecimal("100"), 6, RoundingMode.HALF_UP));
            }
            subtotal = subtotal.add(busTransportCost).add(busAcSurcharge);
        }

        BigDecimal platformFee = BigDecimal.ZERO;
        if (s.platformFeePercent().signum() > 0) {
            platformFee = subtotal.multiply(
                    s.platformFeePercent().divide(new BigDecimal("100"), 6, RoundingMode.HALF_UP));
        }

        BigDecimal tax = BigDecimal.ZERO;
        if (s.taxPercent().signum() > 0) {
            tax = subtotal.add(platformFee).multiply(
                    s.taxPercent().divide(new BigDecimal("100"), 6, RoundingMode.HALF_UP));
        }

        return subtotal.add(platformFee).add(tax).setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * Fallback computation for a single bus configuration (or estimate before buses are assigned).
     */
    public BigDecimal calculateMonthlyAmount(
            BigDecimal morningDistanceKm,
            BigDecimal eveningDistanceKm,
            String shiftType,
            String workingDays,
            String busType,
            Boolean isAc
    ) {
        CorporatePricingSettingsDto s = getSettings();
        BigDecimal ratePerKm = "mini".equalsIgnoreCase(busType) ? s.miniBusRatePerKm() : s.standardBusRatePerKm();
        BigDecimal dailyKm = calculateDailyDistance(morningDistanceKm, eveningDistanceKm, shiftType);
        int serviceDays = "all_days".equalsIgnoreCase(workingDays) ? s.allDaysPerMonth() : s.weekdaysPerMonth();

        BigDecimal monthlyTransportCost = dailyKm.multiply(ratePerKm).multiply(BigDecimal.valueOf(serviceDays));
        BigDecimal acSurcharge = BigDecimal.ZERO;
        if (Boolean.TRUE.equals(isAc) && s.acSurchargePercent().signum() > 0) {
            acSurcharge = monthlyTransportCost.multiply(
                    s.acSurchargePercent().divide(new BigDecimal("100"), 6, RoundingMode.HALF_UP));
        }

        BigDecimal subtotal = monthlyTransportCost.add(acSurcharge);
        BigDecimal platformFee = BigDecimal.ZERO;
        if (s.platformFeePercent().signum() > 0) {
            platformFee = subtotal.multiply(
                    s.platformFeePercent().divide(new BigDecimal("100"), 6, RoundingMode.HALF_UP));
        }

        BigDecimal tax = BigDecimal.ZERO;
        if (s.taxPercent().signum() > 0) {
            tax = subtotal.add(platformFee).multiply(
                    s.taxPercent().divide(new BigDecimal("100"), 6, RoundingMode.HALF_UP));
        }

        return subtotal.add(platformFee).add(tax).setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal calculateDailyDistance(BigDecimal morningDistanceKm, BigDecimal eveningDistanceKm, String shiftType) {
        boolean needsMorning = "morning".equalsIgnoreCase(shiftType) || "both".equalsIgnoreCase(shiftType);
        boolean needsEvening = "evening".equalsIgnoreCase(shiftType) || "both".equalsIgnoreCase(shiftType);

        BigDecimal dailyKm = BigDecimal.ZERO;
        if (needsMorning) dailyKm = dailyKm.add(requirePositiveDistance(morningDistanceKm, "morning"));
        if (needsEvening) dailyKm = dailyKm.add(requirePositiveDistance(eveningDistanceKm, "evening"));
        return dailyKm;
    }

    private static BigDecimal requirePositiveDistance(BigDecimal distanceKm, String shiftLabel) {
        if (distanceKm == null || distanceKm.signum() <= 0) {
            throw new IllegalArgumentException(
                    "A positive " + shiftLabel + " route distance is required.");
        }
        return distanceKm;
    }

    /** Convenience overload — pulls fields directly from the contract DTO. */
    public BigDecimal calculateMonthlyAmount(CorporateContractDto dto) {
        return calculateMonthlyAmount(
                dto.morningDistanceKm(),
                dto.eveningDistanceKm(),
                dto.shiftType(),
                dto.workingDays(),
                dto.busType(),
                dto.isAc()
        );
    }

    /** Overload for contract DTO with explicit assigned buses. */
    public BigDecimal calculateMonthlyAmount(CorporateContractDto dto, List<ContractBusDto> assignedBuses) {
        return calculateMonthlyAmount(
                dto.morningDistanceKm(),
                dto.eveningDistanceKm(),
                dto.shiftType(),
                dto.workingDays(),
                assignedBuses
        );
    }
}
