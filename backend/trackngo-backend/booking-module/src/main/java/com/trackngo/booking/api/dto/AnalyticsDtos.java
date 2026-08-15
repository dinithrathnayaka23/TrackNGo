package com.trackngo.booking.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Payload for the admin analytics dashboard. */
public final class AnalyticsDtos {

    private AnalyticsDtos() {
    }

    /**
     * Headline figures for the selected period. Each {@code *TrendPct} value is the percentage
     * change against the immediately preceding window of the same length, or {@code null} when
     * that earlier window has no data to compare against.
     */
    public record Summary(
            long bookings,
            BigDecimal revenue,
            long activeUsers,
            BigDecimal avgBookingValue,
            Double bookingsTrendPct,
            Double revenueTrendPct,
            Double activeUsersTrendPct,
            Double avgBookingValueTrendPct
    ) {
    }

    /** Revenue for one day, split by bus category. Days with no bookings are returned as zeroes. */
    public record DailyPoint(
            LocalDate date,
            BigDecimal total,
            BigDecimal highway,
            BigDecimal longDistance,
            BigDecimal tripBooking,
            BigDecimal corporate
    ) {
    }

    /**
     * Booking counts per category. {@code pending} covers bookings that are confirmed but whose
     * journey has not been completed yet.
     */
    public record StatusRow(
            String type,
            long completed,
            long pending,
            long cancelled
    ) {
    }

    /** Share of non-cancelled bookings held by one category. */
    public record CategorySlice(
            String type,
            long bookings,
            double sharePct
    ) {
    }

    public record AnalyticsResponse(
            LocalDate from,
            LocalDate to,
            Summary summary,
            List<DailyPoint> series,
            List<StatusRow> statusByType,
            List<CategorySlice> categoryMix
    ) {
    }
}
