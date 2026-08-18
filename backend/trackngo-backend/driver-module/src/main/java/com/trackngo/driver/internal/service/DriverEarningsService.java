package com.trackngo.driver.internal.service;

import com.trackngo.driver.api.dto.DriverEarningDto;
import com.trackngo.driver.api.dto.DriverEarningsDayDto;
import com.trackngo.driver.api.dto.DriverEarningsResponse;
import com.trackngo.driver.internal.entity.DriverUser;
import com.trackngo.driver.internal.repository.UserDriverRepository;
import com.trackngo.commons.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Time;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class DriverEarningsService {
    private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

    private final JdbcTemplate jdbcTemplate;
    private final UserDriverRepository userDriverRepository;

    public DriverEarningsResponse getEarnings(Long driverId) {
        assertDriverOwnsProfile(driverId);
        List<DriverEarningDto> earnings = jdbcTemplate.query("""
                SELECT
                    CONCAT('seat-', sb.seat_booking_id) AS earning_id,
                    sb.booking_reference,
                    CONCAT(
                        COALESCE(NULLIF(TRIM(sb.from_stop), ''), r.start_location),
                        ' - ',
                        COALESCE(NULLIF(TRIM(sb.to_stop), ''), r.end_location)
                    ) AS route,
                    sb.journey_date AS earning_date,
                    sb.journey_time AS earning_time,
                    sb.total_amount AS amount
                FROM seat_booking sb
                INNER JOIN bus b ON b.bus_id = sb.bus_id
                INNER JOIN route r ON r.route_id = sb.route_id
                INNER JOIN payment p ON p.payment_id = sb.payment_id
                    AND p.payment_status = 'success'
                WHERE b.driver_id = ?
                  AND sb.status <> 'cancelled'
                  AND (
                      sb.status IN ('completed', 'boarded')
                      OR sb.journey_date < CURRENT_DATE
                  )

                UNION ALL

                SELECT
                    CONCAT('trip-', tb.trip_booking_id) AS earning_id,
                    CONCAT('BK-', tb.trip_booking_id) AS booking_reference,
                    CONCAT(tb.start_location, ' - ', tb.destination) AS route,
                    tb.start_date AS earning_date,
                    CAST(NULL AS TIME) AS earning_time,
                    COALESCE(tb.final_price, p.amount, tb.advance_payment, 0) AS amount
                FROM trip_booking tb
                LEFT JOIN bus b ON b.bus_id = tb.bus_id
                INNER JOIN payment p ON p.trip_booking_id = tb.trip_booking_id
                    AND p.payment_status = 'success'
                WHERE COALESCE(tb.driver_id, b.driver_id) = ?
                  AND tb.booking_status <> 'cancelled'
                  AND (
                      tb.booking_status = 'completed'
                      OR COALESCE(tb.return_date, tb.start_date) < CURRENT_DATE
                  )

                ORDER BY earning_date DESC, earning_time DESC, earning_id DESC
                """, (rs, rowNum) -> new DriverEarningDto(
                rs.getString("earning_id"),
                rs.getString("booking_reference"),
                rs.getString("route"),
                toLocalDate(rs.getDate("earning_date")),
                toLocalTime(rs.getTime("earning_time")),
                money(rs.getBigDecimal("amount"))
        ), driverId, driverId);

        LocalDate today = LocalDate.now();
        LocalDate weekStart = today.minusDays(6);
        LocalDate previousWeekStart = today.minusDays(13);
        LocalDate previousWeekEnd = today.minusDays(7);

        BigDecimal total = sum(earnings, item -> true);
        BigDecimal monthly = sum(earnings,
                item -> item.date() != null
                        && item.date().getYear() == today.getYear()
                        && item.date().getMonth() == today.getMonth());
        BigDecimal weekly = sum(earnings,
                item -> inRange(item.date(), weekStart, today));
        BigDecimal previousWeekly = sum(earnings,
                item -> inRange(item.date(), previousWeekStart, previousWeekEnd));

        Map<LocalDate, BigDecimal> daily = new LinkedHashMap<>();
        for (LocalDate date = weekStart; !date.isAfter(today); date = date.plusDays(1)) {
            daily.put(date, ZERO);
        }
        for (DriverEarningDto earning : earnings) {
            if (daily.containsKey(earning.date())) {
                daily.put(earning.date(), daily.get(earning.date()).add(earning.amount()));
            }
        }

        List<DriverEarningsDayDto> weeklyBreakdown = daily.entrySet().stream()
                .map(entry -> new DriverEarningsDayDto(entry.getKey(), money(entry.getValue())))
                .toList();

        return new DriverEarningsResponse(
                money(total),
                money(monthly),
                money(weekly),
                money(previousWeekly),
                percentageChange(weekly, previousWeekly),
                earnings,
                weeklyBreakdown
        );
    }

    private void assertDriverOwnsProfile(Long driverId) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        DriverUser user = userDriverRepository.findById(driverId)
                .orElseThrow(() -> new BusinessException("Driver account not found."));
        if (authentication == null || !authentication.isAuthenticated()
                || authentication.getName() == null
                || !authentication.getName().equalsIgnoreCase(user.getEmail())) {
            throw new BusinessException("You can only view your own earnings.");
        }
    }

    private BigDecimal sum(List<DriverEarningDto> earnings,
                           java.util.function.Predicate<DriverEarningDto> predicate) {
        return money(earnings.stream()
                .filter(predicate)
                .map(DriverEarningDto::amount)
                .reduce(ZERO, BigDecimal::add));
    }

    private BigDecimal percentageChange(BigDecimal current, BigDecimal previous) {
        if (previous.compareTo(BigDecimal.ZERO) == 0) {
            return current.compareTo(BigDecimal.ZERO) == 0
                    ? ZERO
                    : BigDecimal.valueOf(100).setScale(2, RoundingMode.HALF_UP);
        }
        return current.subtract(previous)
                .divide(previous, 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
                .setScale(2, RoundingMode.HALF_UP);
    }

    private boolean inRange(LocalDate date, LocalDate start, LocalDate end) {
        return date != null && !date.isBefore(start) && !date.isAfter(end);
    }

    private static LocalDate toLocalDate(java.sql.Date date) {
        return date == null ? null : date.toLocalDate();
    }

    private static LocalTime toLocalTime(Time time) {
        return time == null ? null : time.toLocalTime();
    }

    private static BigDecimal money(BigDecimal amount) {
        return (amount == null ? ZERO : amount).setScale(2, RoundingMode.HALF_UP);
    }
}
