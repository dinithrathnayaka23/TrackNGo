package com.trackngo.booking.internal.repository;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Read-only projections backing the admin analytics dashboard. */
public final class AnalyticsProjections {

    private AnalyticsProjections() {
    }

    /** Aggregate totals for a single period, used for both the current and previous window. */
    public interface SummaryProjection {
        long getBookings();

        BigDecimal getRevenue();

        long getActiveUsers();
    }

    /** One row per (day, bus type) so the frontend can build its per-category series. */
    public interface DailyCategoryProjection {
        LocalDate getDay();

        String getBusType();

        BigDecimal getRevenue();

        long getBookings();
    }

    /** One row per (bus type, booking status) for the status breakdown table. */
    public interface StatusProjection {
        String getBusType();

        String getStatus();

        long getBookings();
    }
}
