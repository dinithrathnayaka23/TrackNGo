package com.trackngo.booking.internal.service;

import com.trackngo.booking.api.dto.TripPricingSettingsDto;
import com.trackngo.commons.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Admin-configurable rates for the private trip-booking (hire-a-bus) pricing
 * formula, mirroring the corporate contract pricing settings pattern. Backs
 * both the passenger-facing "approximate fee" estimate and the price a trip
 * booking is actually created with.
 */
@Service
@RequiredArgsConstructor
public class TripPricingService {

    private static final String SETTINGS_SQL = """
            SELECT daily_rate, small_bus_rate_per_km, large_bus_rate_per_km, passenger_threshold,
                   ac_surcharge_percent, mini_bus_surcharge, advance_payment_percent, updated_at
            FROM trip_pricing_settings WHERE id = 1
            """;

    private static final TripPricingSettingsDto DEFAULT_SETTINGS = new TripPricingSettingsDto(
            new BigDecimal("12000.00"),
            new BigDecimal("250.00"),
            new BigDecimal("400.00"),
            20,
            new BigDecimal("25.00"),
            new BigDecimal("1500.00"),
            new BigDecimal("15.00"),
            null
    );

    private final JdbcTemplate jdbc;

    public TripPricingSettingsDto getSettings() {
        try {
            return jdbc.queryForObject(SETTINGS_SQL, (rs, rowNum) -> new TripPricingSettingsDto(
                    rs.getBigDecimal("daily_rate"),
                    rs.getBigDecimal("small_bus_rate_per_km"),
                    rs.getBigDecimal("large_bus_rate_per_km"),
                    rs.getInt("passenger_threshold"),
                    rs.getBigDecimal("ac_surcharge_percent"),
                    rs.getBigDecimal("mini_bus_surcharge"),
                    rs.getBigDecimal("advance_payment_percent"),
                    rs.getString("updated_at")
            ));
        } catch (EmptyResultDataAccessException ex) {
            return DEFAULT_SETTINGS;
        }
    }

    public TripPricingSettingsDto updateSettings(TripPricingSettingsDto request) {
        requirePositive(request.dailyRate(), "Daily rate");
        requirePositive(request.smallBusRatePerKm(), "Small bus rate per km");
        requirePositive(request.largeBusRatePerKm(), "Large bus rate per km");
        requireNonNegative(request.acSurchargePercent(), "AC surcharge");
        requireNonNegative(request.miniBusSurcharge(), "Mini bus surcharge");
        requireNonNegative(request.advancePaymentPercent(), "Advance payment percentage");
        if (request.advancePaymentPercent().compareTo(new BigDecimal("100")) > 0) {
            throw new BusinessException("Advance payment percentage cannot exceed 100.");
        }
        if (request.passengerThreshold() == null
                || request.passengerThreshold() < 1
                || request.passengerThreshold() > 100) {
            throw new BusinessException("Passenger threshold must be between 1 and 100.");
        }

        jdbc.update("""
                UPDATE trip_pricing_settings SET
                    daily_rate = ?, small_bus_rate_per_km = ?, large_bus_rate_per_km = ?,
                    passenger_threshold = ?, ac_surcharge_percent = ?, mini_bus_surcharge = ?,
                    advance_payment_percent = ?
                WHERE id = 1
                """,
                request.dailyRate(), request.smallBusRatePerKm(), request.largeBusRatePerKm(),
                request.passengerThreshold(), request.acSurchargePercent(), request.miniBusSurcharge(),
                request.advancePaymentPercent()
        );
        return getSettings();
    }

    /**
     * total = dailyRate x days + (distanceKm x rate), where rate is the
     * small- or large-bus per-km rate depending on passengerThreshold, with
     * the AC surcharge applied as a percentage and the Mini Bus surcharge
     * applied as a flat addition. advance = total x advancePaymentPercent.
     */
    public TripFareQuote calculateFare(
            long days, double distanceKm, Integer passengerCount, boolean airConditioned, boolean miniBus
    ) {
        TripPricingSettingsDto settings = getSettings();
        BigDecimal rate = (passengerCount != null && passengerCount <= settings.passengerThreshold())
                ? settings.smallBusRatePerKm()
                : settings.largeBusRatePerKm();
        BigDecimal distanceCost = BigDecimal.valueOf(distanceKm).multiply(rate);
        if (airConditioned) {
            BigDecimal acMultiplier = BigDecimal.ONE.add(
                    settings.acSurchargePercent().divide(new BigDecimal("100"), 4, RoundingMode.HALF_UP));
            distanceCost = distanceCost.multiply(acMultiplier);
        }
        if (miniBus) {
            distanceCost = distanceCost.add(settings.miniBusSurcharge());
        }
        BigDecimal total = settings.dailyRate().multiply(BigDecimal.valueOf(days))
                .add(distanceCost)
                .setScale(2, RoundingMode.HALF_UP);
        return new TripFareQuote(total, advanceFor(total, settings));
    }

    /** Used when an admin negotiates a manual final price, to keep the advance in step with it. */
    public BigDecimal calculateAdvance(BigDecimal finalPrice) {
        return advanceFor(finalPrice, getSettings());
    }

    private BigDecimal advanceFor(BigDecimal finalPrice, TripPricingSettingsDto settings) {
        return finalPrice.multiply(settings.advancePaymentPercent())
                .divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);
    }

    private void requirePositive(BigDecimal value, String label) {
        if (value == null || value.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(label + " must be greater than zero.");
        }
    }

    private void requireNonNegative(BigDecimal value, String label) {
        if (value == null || value.compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException(label + " cannot be negative.");
        }
    }
}
