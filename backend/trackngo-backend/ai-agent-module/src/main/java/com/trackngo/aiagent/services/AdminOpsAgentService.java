package com.trackngo.aiagent.services;

import com.trackngo.booking.api.dto.AdminBusDtos;
import com.trackngo.booking.api.dto.AnalyticsDtos;
import com.trackngo.booking.internal.service.AdminAnalyticsService;
import com.trackngo.booking.internal.service.AdminBusService;
import com.trackngo.complaint.api.ComplaintService;
import com.trackngo.complaint.api.dto.ComplaintDto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * The operations questions an administrator can ask the assistant.
 *
 * Each method answers one question against live data. Previously a single handler
 * printed the same fixed block of seven metrics no matter what was asked, so
 * "which driver has the most complaints" and "how many safety complaints do we
 * have" returned byte-identical text; anything outside its keyword list reached the
 * model with no data and was told to go and look at the admin portal it was already
 * inside.
 *
 * Kept out of AgentRouter, which is already long, so the router decides what is
 * being asked and this service answers it.
 */
@Service
@Slf4j
public class AdminOpsAgentService {

    private static final ZoneId APP_ZONE = ZoneId.of("Asia/Colombo");

    /** Longest window an admin question may look back over. */
    private static final int MAX_WINDOW_DAYS = 365;

    private final JdbcTemplate jdbc;
    private final AdminAnalyticsService analyticsService;
    private final AdminBusService busService;
    private final ComplaintService complaintService;

    public AdminOpsAgentService(
            JdbcTemplate jdbc,
            AdminAnalyticsService analyticsService,
            AdminBusService busService,
            ComplaintService complaintService) {
        this.jdbc = jdbc;
        this.analyticsService = analyticsService;
        this.busService = busService;
        this.complaintService = complaintService;
    }

    /* ── Conversation ─────────────────────────────────────── */

    /**
     * Replies to a greeting or a thank you.
     *
     * Saying "hi" used to return the full operations block — every complaint count,
     * today's revenue and both watchlists — which is not an answer to a greeting.
     * The reply is short, says what can be asked for, and mentions only the one
     * figure an admin would want to hear unprompted: whether anything urgent is
     * still open.
     */
    public String greeting() {
        long highPriority = countLong(
                "SELECT COUNT(*) FROM complaint WHERE priority = 'high' AND status IN ('pending', 'under_review')");

        String urgent;
        if (highPriority == 0) {
            urgent = "Nothing high priority is open at the moment.";
        } else if (highPriority == 1) {
            urgent = "**1 high-priority complaint** is still open.";
        } else {
            urgent = "**%d high-priority complaints** are still open.".formatted(highPriority);
        }

        return """
                %s, I am your TrackNGo operations assistant. %s

                Ask me about complaints, revenue, how a particular bus is doing, or which buses and drivers need attention. I can resolve a complaint too."""
                .formatted(timeOfDayGreeting(), urgent);
    }

    private String timeOfDayGreeting() {
        int hour = java.time.LocalTime.now(APP_ZONE).getHour();
        if (hour < 12) return "Good morning";
        if (hour < 17) return "Good afternoon";
        return "Good evening";
    }

    /* ── Overview ─────────────────────────────────────────── */

    /** The at-a-glance figures an admin opens the dashboard for. */
    public String opsSummary() {
        long total = countLong("SELECT COUNT(*) FROM complaint");
        long pending = countLong("SELECT COUNT(*) FROM complaint WHERE status = 'pending'");
        long underReview = countLong("SELECT COUNT(*) FROM complaint WHERE status = 'under_review'");
        long highPriority = countLong(
                "SELECT COUNT(*) FROM complaint WHERE priority = 'high' AND status IN ('pending', 'under_review')");
        long safety7 = countLong("""
                SELECT COUNT(*) FROM complaint
                WHERE complaint_type = 'safety_concern' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                """);
        long bookingsToday = countLong(
                "SELECT COUNT(*) FROM seat_booking WHERE journey_date = CURDATE() AND status <> 'cancelled'");
        BigDecimal revenueToday = sumMoney("""
                SELECT COALESCE(SUM(total_amount), 0) FROM seat_booking
                WHERE journey_date = CURDATE() AND status <> 'cancelled'
                """);

        return """
                **Operations summary**
                - **Complaints:** %d total, %d pending, %d under review
                - **High priority still open:** %d
                - **Safety complaints (7 days):** %d
                - **Bookings today:** %d
                - **Revenue today:** LKR %s

                %s

                Ask me for revenue trends, a specific bus, the complaint watchlist, or to resolve a complaint."""
                .formatted(total, pending, underReview, highPriority, safety7, bookingsToday,
                        money(revenueToday), watchlist(7, "both"));
    }

    /* ── Complaints ───────────────────────────────────────── */

    /**
     * Complaint counts for a window, broken down the way an admin triages them.
     * Filters are optional; any left null widen the question rather than narrow it.
     */
    public String complaintInsights(Integer days, String status, String priority, String type) {
        int window = window(days, 30);
        List<Object> args = new ArrayList<>();
        StringBuilder where = new StringBuilder("WHERE c.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)");
        args.add(window);
        if (status != null) {
            where.append(" AND c.status = ?");
            args.add(status);
        }
        if (priority != null) {
            where.append(" AND c.priority = ?");
            args.add(priority);
        }
        if (type != null) {
            where.append(" AND c.complaint_type = ?");
            args.add(type);
        }

        long matching = countLong("SELECT COUNT(*) FROM complaint c " + where, args.toArray());
        if (matching == 0) {
            return "No complaints match that in the last %d days.".formatted(window);
        }

        List<Map<String, Object>> byType = jdbc.queryForList(
                "SELECT c.complaint_type AS label, COUNT(*) AS total FROM complaint c " + where
                        + " GROUP BY c.complaint_type ORDER BY total DESC",
                args.toArray());
        List<Map<String, Object>> byStatus = jdbc.queryForList(
                "SELECT c.status AS label, COUNT(*) AS total FROM complaint c " + where
                        + " GROUP BY c.status ORDER BY total DESC",
                args.toArray());

        return """
                **%d complaint%s in the last %d days**%s

                **By type**
                %s

                **By status**
                %s"""
                .formatted(matching, matching == 1 ? "" : "s", window, describeFilters(status, priority, type),
                        bullets(byType), bullets(byStatus));
    }

    /** The complaints an admin should look at first, newest and most severe. */
    public String openComplaints(String priority, int limit) {
        List<Object> args = new ArrayList<>();
        String priorityClause = "";
        if (priority != null) {
            priorityClause = " AND c.priority = ?";
            args.add(priority);
        }
        args.add(Math.min(Math.max(limit, 1), 20));

        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT c.complaint_id, c.complaint_type, c.priority, c.status, c.booking_reference,
                       LEFT(c.description, 110) AS description, DATE(c.created_at) AS raised
                FROM complaint c
                WHERE c.status IN ('pending', 'under_review')
                """ + priorityClause + """
                ORDER BY FIELD(c.priority, 'high', 'medium', 'low'), c.created_at DESC
                LIMIT ?
                """, args.toArray());

        if (rows.isEmpty()) {
            return "Nothing is open right now" + (priority == null ? "." : " at %s priority.".formatted(priority));
        }

        StringBuilder out = new StringBuilder("**Open complaints**\n");
        for (Map<String, Object> row : rows) {
            out.append("- **COMP-%04d** · %s · %s priority · %s\n  %s _(booking %s, raised %s)_\n".formatted(
                    ((Number) row.get("complaint_id")).intValue(),
                    readable(String.valueOf(row.get("complaint_type"))),
                    String.valueOf(row.get("priority")),
                    readable(String.valueOf(row.get("status"))),
                    String.valueOf(row.get("description")).replace("\n", " ").trim(),
                    String.valueOf(row.get("booking_reference")),
                    String.valueOf(row.get("raised"))));
        }
        out.append("\nReply with \"resolve COMP-0017 <your response>\" to close one.");
        return out.toString();
    }

    /** Which buses or drivers attract the most complaints, so repeat offenders surface. */
    public String watchlist(Integer days, String target) {
        int window = window(days, 7);
        boolean wantBuses = !"drivers".equalsIgnoreCase(target);
        boolean wantDrivers = !"buses".equalsIgnoreCase(target);

        StringBuilder out = new StringBuilder();
        if (wantBuses) {
            out.append(topRows("Buses with the most complaints", """
                    SELECT COALESCE(b.bus_number, 'Unlinked') AS label, COUNT(*) AS total
                    FROM complaint c
                    LEFT JOIN seat_booking sb ON sb.booking_reference = c.booking_reference
                    LEFT JOIN bus b ON b.bus_id = sb.bus_id
                    WHERE c.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                    GROUP BY COALESCE(b.bus_number, 'Unlinked')
                    ORDER BY total DESC
                    LIMIT 5
                    """, window));
        }
        if (wantDrivers) {
            if (out.length() > 0) {
                out.append('\n');
            }
            out.append(topRows("Drivers with the most complaints", """
                    SELECT COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ',
                           COALESCE(u.last_name, ''))), ''), 'Unassigned') AS label, COUNT(*) AS total
                    FROM complaint c
                    LEFT JOIN seat_booking sb ON sb.booking_reference = c.booking_reference
                    LEFT JOIN bus b ON b.bus_id = sb.bus_id
                    LEFT JOIN driver d ON d.driver_id = b.driver_id
                    LEFT JOIN `user` u ON u.user_id = d.driver_id
                    WHERE c.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                    GROUP BY label
                    ORDER BY total DESC
                    LIMIT 5
                    """, window));
        }
        return out.toString().trim();
    }

    /* ── Money ────────────────────────────────────────────── */

    /**
     * Revenue and booking volume for a window, against the window before it.
     *
     * Reuses the dashboard's own analytics service so the assistant and the charts
     * can never disagree about what a period earned.
     */
    public String revenue(Integer days) {
        int window = window(days, 30);
        LocalDate to = LocalDate.now(APP_ZONE);
        LocalDate from = to.minusDays(window - 1L);

        AnalyticsDtos.AnalyticsResponse analytics = analyticsService.getAnalytics(from, to);
        AnalyticsDtos.Summary summary = analytics.summary();

        StringBuilder mix = new StringBuilder();
        for (AnalyticsDtos.CategorySlice slice : analytics.categoryMix()) {
            if (slice.bookings() > 0) {
                mix.append("- %s: %d bookings (%.1f%%)\n".formatted(slice.type(), slice.bookings(), slice.sharePct()));
            }
        }

        return """
                **Revenue, %s to %s**
                - **Revenue:** LKR %s %s
                - **Bookings:** %d %s
                - **Active passengers:** %d %s
                - **Average booking value:** LKR %s %s

                **Where the bookings came from**
                %s
                Percentages compare against the previous %d days."""
                .formatted(from, to,
                        money(summary.revenue()), trend(summary.revenueTrendPct()),
                        summary.bookings(), trend(summary.bookingsTrendPct()),
                        summary.activeUsers(), trend(summary.activeUsersTrendPct()),
                        money(summary.avgBookingValue()), trend(summary.avgBookingValueTrendPct()),
                        mix.length() == 0 ? "- No bookings in this period\n" : mix,
                        window);
    }

    /** How one bus is performing: what it earned and how full it ran. */
    public String busPerformance(String busNumber, Integer days) {
        int window = window(days, 30);
        Map<String, Object> bus;
        try {
            bus = jdbc.queryForMap("""
                    SELECT b.bus_id, b.bus_number, b.seat_capacity, b.status,
                           r.route_name,
                           TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS driver_name
                    FROM bus b
                    LEFT JOIN route r ON r.route_id = b.route_id
                    LEFT JOIN driver d ON d.driver_id = b.driver_id
                    LEFT JOIN `user` u ON u.user_id = d.driver_id
                    WHERE UPPER(b.bus_number) = UPPER(?)
                    """, busNumber.trim());
        } catch (EmptyResultDataAccessException ex) {
            return "I could not find a bus numbered **%s**.".formatted(busNumber.trim());
        }

        Long busId = ((Number) bus.get("bus_id")).longValue();
        AdminBusDtos.BusRevenueSummary revenue = busService.getRevenue(busId, window);
        long complaints = countLong("""
                SELECT COUNT(*) FROM complaint c
                JOIN seat_booking sb ON sb.booking_reference = c.booking_reference
                WHERE sb.bus_id = ? AND c.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                """, busId, window);

        int capacity = ((Number) bus.get("seat_capacity")).intValue();
        long seatsOffered = (long) capacity * window;
        double occupancy = seatsOffered == 0 ? 0 : (revenue.totalSeatsSold() * 100.0) / seatsOffered;

        return """
                **%s** · %s · driver %s · status %s

                Over the last %d days:
                - **Revenue:** LKR %s
                - **Seats sold:** %d of about %d offered (%.1f%% occupancy)
                - **Average per day:** LKR %s
                - **Complaints:** %d"""
                .formatted(
                        bus.get("bus_number"),
                        bus.get("route_name") == null ? "no route assigned" : bus.get("route_name"),
                        blankTo(String.valueOf(bus.get("driver_name")), "unassigned"),
                        bus.get("status"),
                        window,
                        money(revenue.totalRevenue()),
                        revenue.totalSeatsSold(), seatsOffered, occupancy,
                        money(revenue.averagePerDay()),
                        complaints);
    }

    /* ── Actions ──────────────────────────────────────────── */

    /**
     * Closes a complaint with an admin response.
     *
     * The response text is required: resolving without telling the passenger what
     * was done leaves them with a closed complaint and no explanation, which is the
     * thing complaints exist to avoid.
     */
    public String resolveComplaint(Long complaintId, String adminResponse) {
        if (complaintId == null) {
            return "Which complaint should I resolve? Give me its id, for example \"resolve COMP-0017 refunded the fare\".";
        }
        if (adminResponse == null || adminResponse.isBlank()) {
            return "Tell me what to record as the response and I will close **COMP-%04d**, for example \"resolve COMP-%04d spoke to the driver and issued a warning\"."
                    .formatted(complaintId, complaintId);
        }

        ComplaintDto complaint;
        try {
            complaint = complaintService.get(complaintId);
        } catch (RuntimeException ex) {
            return "I could not find complaint **COMP-%04d**.".formatted(complaintId);
        }
        if ("resolved".equalsIgnoreCase(complaint.getStatus())) {
            return "**COMP-%04d** is already resolved.".formatted(complaintId);
        }

        complaint.setStatus("resolved");
        complaint.setAdminResponse(adminResponse.trim());
        try {
            ComplaintDto updated = complaintService.update(complaintId, complaint);
            return """
                    **COMP-%04d resolved.**
                    - **Type:** %s
                    - **Priority:** %s
                    - **Response recorded:** %s

                    The passenger can see this in their complaint history."""
                    .formatted(complaintId, readable(updated.getComplaintType()),
                            updated.getPriority(), adminResponse.trim());
        } catch (RuntimeException ex) {
            log.warn("Resolving complaint {} failed: {}", complaintId, ex.getMessage());
            return "I could not resolve **COMP-%04d**: %s".formatted(complaintId, ex.getMessage());
        }
    }

    /* ── Helpers ──────────────────────────────────────────── */

    private int window(Integer days, int fallback) {
        if (days == null || days < 1) {
            return fallback;
        }
        return Math.min(days, MAX_WINDOW_DAYS);
    }

    private String describeFilters(String status, String priority, String type) {
        List<String> parts = new ArrayList<>();
        if (status != null) parts.add(readable(status));
        if (priority != null) parts.add(priority + " priority");
        if (type != null) parts.add(readable(type));
        return parts.isEmpty() ? "" : " (" + String.join(", ", parts) + ")";
    }

    private String topRows(String heading, String sql, int window) {
        List<Map<String, Object>> rows = jdbc.queryForList(sql, window);
        if (rows.isEmpty()) {
            return "**%s (last %d days)**\n- Nothing recorded\n".formatted(heading, window);
        }
        return "**%s (last %d days)**\n%s".formatted(heading, window, bullets(rows));
    }

    private String bullets(List<Map<String, Object>> rows) {
        StringBuilder out = new StringBuilder();
        for (Map<String, Object> row : rows) {
            out.append("- %s: %d\n".formatted(
                    readable(String.valueOf(row.get("label"))),
                    ((Number) row.get("total")).longValue()));
        }
        return out.toString();
    }

    /** Turns an enum-style database value into something an admin reads without decoding. */
    private String readable(String value) {
        if (value == null || value.isBlank()) {
            return "Unknown";
        }
        String spaced = value.replace('_', ' ').trim();
        return Character.toUpperCase(spaced.charAt(0)) + spaced.substring(1);
    }

    private String blankTo(String value, String fallback) {
        return value == null || value.isBlank() || "null".equals(value) ? fallback : value;
    }

    private String trend(Double pct) {
        if (pct == null) {
            return "(no earlier period to compare)";
        }
        return "(%s%.1f%% vs previous period)".formatted(pct >= 0 ? "+" : "", pct);
    }

    private String money(BigDecimal amount) {
        return (amount == null ? BigDecimal.ZERO : amount).setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    private long countLong(String sql, Object... args) {
        try {
            Long value = jdbc.queryForObject(sql, Long.class, args);
            return value == null ? 0L : value;
        } catch (DataAccessException ex) {
            log.warn("Admin count query failed: {}", ex.getMessage());
            return 0L;
        }
    }

    private BigDecimal sumMoney(String sql, Object... args) {
        try {
            BigDecimal value = jdbc.queryForObject(sql, BigDecimal.class, args);
            return value == null ? BigDecimal.ZERO : value;
        } catch (DataAccessException ex) {
            log.warn("Admin sum query failed: {}", ex.getMessage());
            return BigDecimal.ZERO;
        }
    }

    /** Normalises a complaint status an admin may have phrased loosely. */
    public static String normalizeStatus(String value) {
        if (value == null) return null;
        return switch (value.trim().toLowerCase(Locale.ROOT)) {
            case "pending", "open" -> "pending";
            case "under_review", "under review", "reviewing" -> "under_review";
            case "resolved", "closed" -> "resolved";
            case "rejected" -> "rejected";
            default -> null;
        };
    }

    /** Normalises a complaint priority an admin may have phrased loosely. */
    public static String normalizePriority(String value) {
        if (value == null) return null;
        return switch (value.trim().toLowerCase(Locale.ROOT)) {
            case "low" -> "low";
            case "medium", "normal" -> "medium";
            case "high", "urgent", "critical" -> "high";
            default -> null;
        };
    }

    /** Normalises a complaint type an admin may have phrased loosely. */
    public static String normalizeType(String value) {
        if (value == null) return null;
        return switch (value.trim().toLowerCase(Locale.ROOT).replace(' ', '_')) {
            case "driver_behavior", "bus_condition", "route_issue", "late_arrival",
                 "payment_issue", "booking_issue", "safety_concern", "other" -> value.trim().toLowerCase(Locale.ROOT).replace(' ', '_');
            case "safety" -> "safety_concern";
            case "driver" -> "driver_behavior";
            case "payment" -> "payment_issue";
            case "delay", "late" -> "late_arrival";
            default -> null;
        };
    }
}
