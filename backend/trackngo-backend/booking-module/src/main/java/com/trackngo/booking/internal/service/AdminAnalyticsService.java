package com.trackngo.booking.internal.service;

import com.trackngo.booking.api.dto.AnalyticsDtos.AnalyticsResponse;
import com.trackngo.booking.api.dto.AnalyticsDtos.CategorySlice;
import com.trackngo.booking.api.dto.AnalyticsDtos.DailyPoint;
import com.trackngo.booking.api.dto.AnalyticsDtos.StatusRow;
import com.trackngo.booking.api.dto.AnalyticsDtos.Summary;
import com.trackngo.booking.internal.repository.AnalyticsProjections;
import com.trackngo.booking.internal.repository.AnalyticsRepository;
import com.trackngo.commons.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Builds the admin analytics dashboard payload from live booking data. */
@Service
@RequiredArgsConstructor
public class AdminAnalyticsService {

    /** Bus categories, in the order the dashboard displays them. */
    private enum Category {
        HIGHWAY("highway", "Highway"),
        LONG_DISTANCE("long_distance", "Long-distance"),
        TRIP_BOOKING("trip_booking", "Trip Bookings"),
        CORPORATE("corporate", "Corporate");

        private final String dbValue;
        private final String label;

        Category(String dbValue, String label) {
            this.dbValue = dbValue;
            this.label = label;
        }

        static Category fromDbValue(String value) {
            if (value == null) {
                return null;
            }
            for (Category category : values()) {
                if (category.dbValue.equalsIgnoreCase(value)) {
                    return category;
                }
            }
            return null;
        }
    }

    /** Guards against a range so wide it would return an unusable number of daily points. */
    private static final long MAX_RANGE_DAYS = 366;

    private final AnalyticsRepository analyticsRepository;

    @Transactional(readOnly = true)
    public AnalyticsResponse getAnalytics(LocalDate from, LocalDate to) {
        LocalDate resolvedTo = to != null ? to : LocalDate.now();
        LocalDate resolvedFrom = from != null ? from : resolvedTo.minusDays(29);

        if (resolvedFrom.isAfter(resolvedTo)) {
            throw new BusinessException("Start date must be on or before end date.");
        }
        long days = ChronoUnit.DAYS.between(resolvedFrom, resolvedTo) + 1;
        if (days > MAX_RANGE_DAYS) {
            throw new BusinessException("Date range cannot exceed " + MAX_RANGE_DAYS + " days.");
        }

        // The comparison window is the same length, ending the day before the selected range.
        LocalDate previousTo = resolvedFrom.minusDays(1);
        LocalDate previousFrom = previousTo.minusDays(days - 1);

        AnalyticsProjections.SummaryProjection current = analyticsRepository.summarise(resolvedFrom, resolvedTo);
        AnalyticsProjections.SummaryProjection previous = analyticsRepository.summarise(previousFrom, previousTo);

        return new AnalyticsResponse(
                resolvedFrom,
                resolvedTo,
                buildSummary(current, previous),
                buildSeries(resolvedFrom, resolvedTo),
                buildStatusRows(resolvedFrom, resolvedTo),
                buildCategoryMix(resolvedFrom, resolvedTo));
    }

    private Summary buildSummary(AnalyticsProjections.SummaryProjection current,
                                 AnalyticsProjections.SummaryProjection previous) {
        long bookings = current.getBookings();
        BigDecimal revenue = nullSafe(current.getRevenue());
        long activeUsers = current.getActiveUsers();
        BigDecimal avgBookingValue = averageValue(revenue, bookings);

        long prevBookings = previous.getBookings();
        BigDecimal prevRevenue = nullSafe(previous.getRevenue());
        long prevActiveUsers = previous.getActiveUsers();
        BigDecimal prevAvgBookingValue = averageValue(prevRevenue, prevBookings);

        return new Summary(
                bookings,
                revenue,
                activeUsers,
                avgBookingValue,
                trendPct(BigDecimal.valueOf(bookings), BigDecimal.valueOf(prevBookings)),
                trendPct(revenue, prevRevenue),
                trendPct(BigDecimal.valueOf(activeUsers), BigDecimal.valueOf(prevActiveUsers)),
                trendPct(avgBookingValue, prevAvgBookingValue));
    }

    /**
     * Returns one point per calendar day in the range. Days the database has no rows for are
     * emitted as zeroes so the chart's x-axis stays evenly spaced.
     */
    private List<DailyPoint> buildSeries(LocalDate from, LocalDate to) {
        Map<LocalDate, Map<Category, BigDecimal>> byDay = new LinkedHashMap<>();
        for (AnalyticsProjections.DailyCategoryProjection row : analyticsRepository.dailyByCategory(from, to)) {
            Category category = Category.fromDbValue(row.getBusType());
            if (category == null) {
                continue;
            }
            byDay.computeIfAbsent(row.getDay(), key -> new EnumMap<>(Category.class))
                    .merge(category, nullSafe(row.getRevenue()), BigDecimal::add);
        }

        List<DailyPoint> series = new ArrayList<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            Map<Category, BigDecimal> revenueByCategory = byDay.getOrDefault(day, Map.of());
            BigDecimal highway = revenueByCategory.getOrDefault(Category.HIGHWAY, BigDecimal.ZERO);
            BigDecimal longDistance = revenueByCategory.getOrDefault(Category.LONG_DISTANCE, BigDecimal.ZERO);
            BigDecimal tripBooking = revenueByCategory.getOrDefault(Category.TRIP_BOOKING, BigDecimal.ZERO);
            BigDecimal corporate = revenueByCategory.getOrDefault(Category.CORPORATE, BigDecimal.ZERO);
            BigDecimal total = highway.add(longDistance).add(tripBooking).add(corporate);
            series.add(new DailyPoint(day, total, highway, longDistance, tripBooking, corporate));
        }
        return series;
    }

    private List<StatusRow> buildStatusRows(LocalDate from, LocalDate to) {
        Map<Category, long[]> counts = new EnumMap<>(Category.class);
        for (Category category : Category.values()) {
            counts.put(category, new long[3]); // completed, pending, cancelled
        }

        for (AnalyticsProjections.StatusProjection row : analyticsRepository.statusByCategory(from, to)) {
            Category category = Category.fromDbValue(row.getBusType());
            if (category == null) {
                continue;
            }
            long[] slot = counts.get(category);
            String status = row.getStatus() == null ? "" : row.getStatus().toLowerCase();
            switch (status) {
                case "completed" -> slot[0] += row.getBookings();
                case "confirmed" -> slot[1] += row.getBookings();
                case "cancelled" -> slot[2] += row.getBookings();
                default -> {
                    // Unknown status values are ignored rather than silently miscounted.
                }
            }
        }

        List<StatusRow> rows = new ArrayList<>();
        for (Category category : Category.values()) {
            long[] slot = counts.get(category);
            rows.add(new StatusRow(category.label, slot[0], slot[1], slot[2]));
        }
        return rows;
    }

    private List<CategorySlice> buildCategoryMix(LocalDate from, LocalDate to) {
        Map<Category, Long> bookingsByCategory = new EnumMap<>(Category.class);
        for (Category category : Category.values()) {
            bookingsByCategory.put(category, 0L);
        }
        for (AnalyticsProjections.DailyCategoryProjection row : analyticsRepository.dailyByCategory(from, to)) {
            Category category = Category.fromDbValue(row.getBusType());
            if (category != null) {
                bookingsByCategory.merge(category, row.getBookings(), Long::sum);
            }
        }

        long total = bookingsByCategory.values().stream().mapToLong(Long::longValue).sum();
        List<CategorySlice> mix = new ArrayList<>();
        for (Category category : Category.values()) {
            long bookings = bookingsByCategory.get(category);
            double share = total == 0 ? 0d : round1((bookings * 100d) / total);
            mix.add(new CategorySlice(category.label, bookings, share));
        }
        return mix;
    }

    private static BigDecimal averageValue(BigDecimal revenue, long bookings) {
        if (bookings <= 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return revenue.divide(BigDecimal.valueOf(bookings), 2, RoundingMode.HALF_UP);
    }

    /** Null means "no basis for comparison", which the UI renders differently from a flat 0%. */
    private static Double trendPct(BigDecimal current, BigDecimal previous) {
        if (previous == null || previous.compareTo(BigDecimal.ZERO) == 0) {
            return null;
        }
        BigDecimal change = current.subtract(previous)
                .multiply(BigDecimal.valueOf(100))
                .divide(previous, 2, RoundingMode.HALF_UP);
        return round1(change.doubleValue());
    }

    private static double round1(double value) {
        return Math.round(value * 10d) / 10d;
    }

    private static BigDecimal nullSafe(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }
}
