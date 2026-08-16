package com.trackngo.booking.internal.repository;

import com.trackngo.booking.internal.entity.Booking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

/**
 * Aggregate queries for the admin analytics dashboard.
 *
 * <p>All figures are derived from {@code seat_booking} joined to {@code bus}, so the
 * booking category always reflects {@code bus.bus_type}. Cancelled bookings are excluded
 * from revenue and volume totals but are still reported by the status breakdown.
 *
 * <p>Date bounds are inclusive on both ends and compare against {@code DATE(created_at)}
 * so a booking made at any time on the end date is counted.
 */
public interface AnalyticsRepository extends JpaRepository<Booking, Long> {

    @Query(value = """
            SELECT
                COUNT(*) AS bookings,
                COALESCE(SUM(sb.total_amount), 0) AS revenue,
                COUNT(DISTINCT sb.passenger_id) AS activeUsers
            FROM seat_booking sb
            WHERE DATE(sb.created_at) BETWEEN :from AND :to
              AND sb.status <> 'cancelled'
            """, nativeQuery = true)
    AnalyticsProjections.SummaryProjection summarise(
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);

    @Query(value = """
            SELECT
                DATE(sb.created_at) AS day,
                b.bus_type AS busType,
                COALESCE(SUM(sb.total_amount), 0) AS revenue,
                COUNT(*) AS bookings
            FROM seat_booking sb
            INNER JOIN bus b ON b.bus_id = sb.bus_id
            WHERE DATE(sb.created_at) BETWEEN :from AND :to
              AND sb.status <> 'cancelled'
            GROUP BY DATE(sb.created_at), b.bus_type
            ORDER BY DATE(sb.created_at)
            """, nativeQuery = true)
    List<AnalyticsProjections.DailyCategoryProjection> dailyByCategory(
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);

    @Query(value = """
            SELECT
                b.bus_type AS busType,
                sb.status AS status,
                COUNT(*) AS bookings
            FROM seat_booking sb
            INNER JOIN bus b ON b.bus_id = sb.bus_id
            WHERE DATE(sb.created_at) BETWEEN :from AND :to
            GROUP BY b.bus_type, sb.status
            """, nativeQuery = true)
    List<AnalyticsProjections.StatusProjection> statusByCategory(
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);
}
