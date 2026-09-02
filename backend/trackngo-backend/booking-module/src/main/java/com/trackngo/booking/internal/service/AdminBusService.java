package com.trackngo.booking.internal.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.trackngo.booking.api.dto.AdminBusDtos.*;
import com.trackngo.commons.booking.BookingDisruptionHandler;
import com.trackngo.commons.exception.BusinessException;
import com.trackngo.notification.api.NotificationDispatcher;
import com.trackngo.notification.api.NotificationType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.annotation.PostConstruct;

import java.math.BigDecimal;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.sql.Time;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;

@Service
public class AdminBusService {

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    private final BookingDisruptionHandler disruptionHandler;
    private final NotificationDispatcher notifications;

    public AdminBusService(
            JdbcTemplate jdbc,
            ObjectMapper mapper,
            BookingDisruptionHandler disruptionHandler,
            NotificationDispatcher notifications
    ) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.disruptionHandler = disruptionHandler;
        this.notifications = notifications;
    }

    @PostConstruct
    void ensureSeatLayoutTable() {
        jdbc.execute("""
                CREATE TABLE IF NOT EXISTS seat_layout (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    bus_id BIGINT NOT NULL,
                    seat_label VARCHAR(10) NOT NULL,
                    row_num INT NOT NULL,
                    position_group VARCHAR(10) NOT NULL,
                    position_index INT NOT NULL,
                    UNIQUE KEY uk_bus_seat (bus_id, seat_label),
                    FOREIGN KEY (bus_id) REFERENCES bus(bus_id) ON DELETE CASCADE
                )
                """);
    }

    /* ── List all buses ───────────────────────────────────── */
    public List<BusListItem> listBuses() {
        String sql = """
            SELECT b.bus_id, b.bus_number, b.bus_brand, b.seat_capacity,
                   b.bus_type, b.bus_condition, b.status, b.amenities,
                   b.start_time, b.end_time, b.return_start_time, b.return_end_time,
                   b.registration_number, b.insurance_exp_date,
                   b.driver_id, b.route_id,
                   CONCAT(u.first_name, ' ', u.last_name) AS driver_name,
                   r.route_name, r.estimated_time_duration
            FROM bus b
            LEFT JOIN driver d ON b.driver_id = d.driver_id
            LEFT JOIN `user` u ON d.driver_id = u.user_id
            LEFT JOIN route r ON b.route_id = r.route_id
            ORDER BY b.bus_id
            """;

        List<Map<String, Object>> rows = jdbc.queryForList(sql);
        List<BusListItem> results = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            results.add(new BusListItem(
                    toLong(row.get("bus_id")),
                    (String) row.get("bus_number"),
                    (String) row.get("bus_brand"),
                    toInt(row.get("seat_capacity")),
                    (String) row.get("bus_type"),
                    (String) row.get("bus_condition"),
                    (String) row.get("status"),
                    parseAmenities(row.get("amenities")),
                    (String) row.get("driver_name"),
                    toLongNullable(row.get("driver_id")),
                    (String) row.get("route_name"),
                    toLongNullable(row.get("route_id")),
                    formatTime(row.get("start_time")),
                    computeEndTime(row.get("start_time"), row.get("route_id"), row.get("estimated_time_duration"), row.get("end_time")),
                    formatTime(row.get("return_start_time")),
                    formatTime(row.get("return_end_time")),
                    (String) row.get("registration_number"),
                    row.get("insurance_exp_date") != null ? row.get("insurance_exp_date").toString() : null));
        }
        return results;
    }

    /* ── Get single bus detail ────────────────────────────── */
    public BusDetail getBusDetail(Long busId) {
        String sql = """
            SELECT b.bus_id, b.bus_number, b.bus_brand, b.seat_capacity,
                   b.bus_type, b.bus_condition, b.status, b.amenities,
                   b.start_time, b.end_time, b.return_start_time, b.return_end_time,
                   b.registration_number, b.insurance_exp_date,
                   b.driver_id, b.route_id,
                   CONCAT(u.first_name, ' ', u.last_name) AS driver_name,
                   d.phone_number AS driver_phone, d.average_rating,
                   r.route_name, r.fee, r.estimated_time_duration
            FROM bus b
            LEFT JOIN driver d ON b.driver_id = d.driver_id
            LEFT JOIN `user` u ON d.driver_id = u.user_id
            LEFT JOIN route r ON b.route_id = r.route_id
            WHERE b.bus_id = ?
            """;

        Map<String, Object> row = jdbc.queryForMap(sql, busId);

        return new BusDetail(
                toLong(row.get("bus_id")),
                (String) row.get("bus_number"),
                (String) row.get("bus_brand"),
                toInt(row.get("seat_capacity")),
                (String) row.get("bus_type"),
                (String) row.get("bus_condition"),
                (String) row.get("status"),
                parseAmenities(row.get("amenities")),
                formatTime(row.get("start_time")),
                computeEndTime(row.get("start_time"), row.get("route_id"), row.get("estimated_time_duration"), row.get("end_time")),
                formatTime(row.get("return_start_time")),
                formatTime(row.get("return_end_time")),
                (String) row.get("registration_number"),
                row.get("insurance_exp_date") != null ? row.get("insurance_exp_date").toString() : null,
                toLongNullable(row.get("driver_id")),
                (String) row.get("driver_name"),
                (String) row.get("driver_phone"),
                toDouble(row.get("average_rating")),
                toLongNullable(row.get("route_id")),
                (String) row.get("route_name"),
                toBigDecimal(row.get("fee")));
    }

    /* ── Create bus ───────────────────────────────────────── */
    public Long createBus(SaveBusRequest req) {
        assertDriverNotAlreadyAssigned(req.driverId(), null);
        assertInsuranceNotExpired(req.insuranceExpDate());
        String amenitiesJson = toJson(req.amenities());
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbc.update(con -> {
            PreparedStatement ps = con.prepareStatement(
                    "INSERT INTO bus (bus_number, bus_brand, seat_capacity, bus_type, bus_condition, " +
                    "status, amenities, start_time, end_time, return_start_time, return_end_time, " +
                    "registration_number, insurance_exp_date, driver_id, route_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    Statement.RETURN_GENERATED_KEYS
            );
            ps.setString(1, req.busNumber());
            ps.setString(2, req.busBrand());
            ps.setInt(3, req.seatCapacity());
            ps.setString(4, req.busType());
            ps.setString(5, req.busCondition());
            ps.setString(6, req.status() != null ? req.status() : "active");
            ps.setString(7, amenitiesJson);
            setNullableTime(ps, 8, req.startTime());
            setNullableTime(ps, 9, req.endTime());
            setNullableTime(ps, 10, req.returnStartTime());
            setNullableTime(ps, 11, req.returnEndTime());
            ps.setString(12, req.registrationNumber());
            ps.setString(13, req.insuranceExpDate());
            setNullableLong(ps, 14, req.driverId());
            setNullableLong(ps, 15, req.routeId());
            return ps;
        }, keyHolder);
        return keyHolder.getKey().longValue();
    }

    /* ── Update bus ───────────────────────────────────────── */
    @Transactional
    public void updateBus(Long busId, SaveBusRequest req) {
        assertDriverNotAlreadyAssigned(req.driverId(), busId);
        assertInsuranceNotExpired(req.insuranceExpDate());
        String amenitiesJson = toJson(req.amenities());
        // The driver and bus number are read alongside the status because the
        // update overwrites all three, and the driver has to be told about it.
        Map<String, Object> previousBus = jdbc.queryForMap(
                "SELECT status, driver_id, bus_number FROM bus WHERE bus_id = ?",
                busId
        );
        String previousStatus = (String) previousBus.get("status");
        if (isUnavailable(req.status())) {
            disruptionHandler.cancelFutureBookingsForBus(
                    busId,
                    "the bus was placed under " + req.status().toLowerCase(Locale.ROOT)
            );
        } else if (isUnavailable(previousStatus) && "active".equalsIgnoreCase(req.status())) {
            disruptionHandler.notifyFutureBookingPassengersBusRestored(busId);
        }
        jdbc.update(
                "UPDATE bus SET bus_number=?, bus_brand=?, seat_capacity=?, bus_type=?, bus_condition=?, " +
                "status=?, amenities=?, start_time=?, end_time=?, return_start_time=?, return_end_time=?, " +
                "registration_number=?, insurance_exp_date=?, driver_id=?, route_id=? WHERE bus_id=?",
                req.busNumber(), req.busBrand(), req.seatCapacity(), req.busType(), req.busCondition(),
                req.status(), amenitiesJson,
                req.startTime() != null && !req.startTime().isEmpty() ? req.startTime() : null,
                req.endTime() != null && !req.endTime().isEmpty() ? req.endTime() : null,
                req.returnStartTime() != null && !req.returnStartTime().isEmpty() ? req.returnStartTime() : null,
                req.returnEndTime() != null && !req.returnEndTime().isEmpty() ? req.returnEndTime() : null,
                req.registrationNumber(), req.insuranceExpDate(),
                req.driverId(), req.routeId(), busId
        );

        notifyDriverOfBusChange(previousBus, req);
    }

    /**
     * Keeps drivers informed about the bus they are responsible for.
     *
     * Two changes matter to a driver, and the admin bus form is the only place
     * either happens: being put on (or taken off) a bus, and that bus changing
     * service status. A reassignment implies the status notice, so only the
     * assignment is announced when both change at once.
     */
    private void notifyDriverOfBusChange(Map<String, Object> previousBus, SaveBusRequest req) {
        Long previousDriverId = toLongNullable(previousBus.get("driver_id"));
        Long newDriverId = req.driverId();
        String busNumber = req.busNumber() != null
                ? req.busNumber()
                : (String) previousBus.get("bus_number");

        if (!Objects.equals(previousDriverId, newDriverId)) {
            notifications.toDriver(
                    newDriverId,
                    NotificationType.JOURNEY,
                    "Bus Assigned",
                    "You are now assigned to bus " + busNumber
                            + ". Check your allocations for the route and timetable."
            );
            notifications.toDriver(
                    previousDriverId,
                    NotificationType.JOURNEY,
                    "Bus Unassigned",
                    "You are no longer assigned to bus " + busNumber + "."
            );
            return;
        }

        String previousStatus = (String) previousBus.get("status");
        if (req.status() != null && !req.status().equalsIgnoreCase(previousStatus)) {
            notifications.toDriver(
                    newDriverId,
                    NotificationType.JOURNEY,
                    "Bus Status Changed",
                    "Bus " + busNumber + " is now marked as "
                            + req.status().toLowerCase(Locale.ROOT) + "."
            );
        }
    }

    /* ── Delete bus ───────────────────────────────────────── */
    @Transactional
    public void deleteBus(Long busId) {
        disruptionHandler.cancelFutureBookingsForBus(busId, "the bus was removed from service");
        jdbc.update("DELETE FROM seat_layout WHERE bus_id = ?", busId);
        // Keep the bus row (and its driver_id) for booking/refund/audit history -
        // driver earnings are computed by joining historical bookings back to
        // bus.driver_id, so clearing it here would erase that driver's past
        // earnings for this bus. The one-driver-one-bus unique index only
        // applies to non-inactive buses (see V27 migration), so an inactive
        // bus keeping its driver_id does not block that driver being assigned
        // to a new bus.
        jdbc.update("UPDATE bus SET status = 'inactive' WHERE bus_id = ?", busId);
    }

    private boolean isUnavailable(String status) {
        return status != null && ("maintenance".equalsIgnoreCase(status)
                || "inactive".equalsIgnoreCase(status));
    }

    /* ── Get seat layout ──────────────────────────────────── */
    public List<SeatLayoutRow> getSeatLayout(Long busId) {
        String sql = "SELECT seat_label, row_num, position_group, position_index " +
                "FROM seat_layout WHERE bus_id = ? ORDER BY row_num, position_index";
        List<Map<String, Object>> rows = jdbc.queryForList(sql, busId);

        if (rows.isEmpty()) {
            return List.of();
        }

        Map<Integer, List<String>> leftMap = new TreeMap<>();
        Map<Integer, List<String>> rightMap = new TreeMap<>();
        Map<Integer, List<String>> backMap = new TreeMap<>();

        for (Map<String, Object> r : rows) {
            int rowNum = ((Number) r.get("row_num")).intValue();
            String label = (String) r.get("seat_label");
            String group = (String) r.get("position_group");

            switch (group) {
                case "left" -> leftMap.computeIfAbsent(rowNum, k -> new ArrayList<>()).add(label);
                case "right" -> rightMap.computeIfAbsent(rowNum, k -> new ArrayList<>()).add(label);
                case "back" -> backMap.computeIfAbsent(rowNum, k -> new ArrayList<>()).add(label);
            }
        }

        Set<Integer> allRows = new TreeSet<>();
        allRows.addAll(leftMap.keySet());
        allRows.addAll(rightMap.keySet());
        allRows.addAll(backMap.keySet());

        List<SeatLayoutRow> result = new ArrayList<>();
        for (int rowNum : allRows) {
            List<String> back = backMap.getOrDefault(rowNum, null);
            result.add(new SeatLayoutRow(
                    rowNum,
                    leftMap.getOrDefault(rowNum, List.of()),
                    rightMap.getOrDefault(rowNum, List.of()),
                    back));
        }
        return result;
    }

    /* ── Save seat layout ─────────────────────────────────── */
    @Transactional
    public void saveSeatLayout(Long busId, SaveSeatLayoutRequest req) {
        jdbc.update("DELETE FROM seat_layout WHERE bus_id = ?", busId);

        if (req.rows() == null || req.rows().isEmpty())
            return;

        Set<String> blockedLabels = req.blockedSeats() != null
                ? new HashSet<>(req.blockedSeats())
                : Set.of();

        String insertSql = "INSERT INTO seat_layout (bus_id, seat_label, row_num, position_group, position_index, blocked) "
                +
                "VALUES (?, ?, ?, ?, ?, ?)";

        int totalSeats = 0;
        for (SeatLayoutRow row : req.rows()) {
            if (row.left() != null) {
                for (int i = 0; i < row.left().size(); i++) {
                    String label = row.left().get(i);
                    jdbc.update(insertSql, busId, label, row.rowNum(), "left", i, blockedLabels.contains(label));
                    totalSeats++;
                }
            }
            if (row.right() != null) {
                for (int i = 0; i < row.right().size(); i++) {
                    String label = row.right().get(i);
                    jdbc.update(insertSql, busId, label, row.rowNum(), "right", i, blockedLabels.contains(label));
                    totalSeats++;
                }
            }
            if (row.lastRow() != null) {
                for (int i = 0; i < row.lastRow().size(); i++) {
                    String label = row.lastRow().get(i);
                    jdbc.update(insertSql, busId, label, row.rowNum(), "back", i, blockedLabels.contains(label));
                    totalSeats++;
                }
            }
        }

        // Sync seat_capacity in bus table
        if (totalSeats > 0) {
            jdbc.update("UPDATE bus SET seat_capacity = ? WHERE bus_id = ?", totalSeats, busId);
        }
    }

    /**
     * A driver can only be responsible for one bus at a time - drivers rely on a
     * single fixed schedule/route/seat-layout for their day. Reject the save
     * before it touches the bus row if the requested driver is already on a
     * different, still-in-service bus.
     */
    private void assertDriverNotAlreadyAssigned(Long driverId, Long excludeBusId) {
        if (driverId == null) {
            return;
        }
        String sql = "SELECT bus_number FROM bus WHERE driver_id = ? AND status <> 'inactive'"
                + (excludeBusId != null ? " AND bus_id <> ?" : "");
        List<Map<String, Object>> rows = excludeBusId != null
                ? jdbc.queryForList(sql, driverId, excludeBusId)
                : jdbc.queryForList(sql, driverId);
        if (!rows.isEmpty()) {
            throw new BusinessException(
                    "This driver is already assigned to bus " + rows.get(0).get("bus_number")
                            + ". Unassign them from that bus first.");
        }
    }

    /**
     * A bus with expired (or same-day-expiring) insurance should never be put
     * into service - the form's date input already blocks picking a past
     * date, but this is the guard that actually matters since nothing else
     * stops an API call from bypassing the UI.
     */
    private void assertInsuranceNotExpired(String insuranceExpDate) {
        if (insuranceExpDate == null || insuranceExpDate.isBlank()) {
            throw new BusinessException("Insurance expiry date is required.");
        }
        LocalDate expiry;
        try {
            expiry = LocalDate.parse(insuranceExpDate);
        } catch (DateTimeParseException e) {
            throw new BusinessException("Insurance expiry date is invalid.");
        }
        if (!expiry.isAfter(LocalDate.now())) {
            throw new BusinessException(
                    "Insurance expiry date must be after today - this bus's insurance is expired or expires today.");
        }
    }

    /* ── Dropdown options ─────────────────────────────────── */
    public List<DriverOption> getDriverOptions() {
        String sql = """
                SELECT d.driver_id, CONCAT(u.first_name, ' ', u.last_name) AS name,
                       (SELECT b.bus_number FROM bus b
                        WHERE b.driver_id = d.driver_id AND b.status <> 'inactive'
                        ORDER BY b.bus_id LIMIT 1) AS assigned_bus_number
                FROM driver d
                JOIN `user` u ON d.driver_id = u.user_id
                ORDER BY name
                """;
        return jdbc.query(sql, (rs, rowNum) -> new DriverOption(
                rs.getLong("driver_id"), rs.getString("name"), rs.getString("assigned_bus_number")));
    }

    public List<RouteOption> getRouteOptions() {
        String sql = "SELECT route_id, route_name, estimated_time_duration FROM route WHERE is_active = 1 ORDER BY route_name";
        return jdbc.query(sql, (rs, rowNum) -> new RouteOption(rs.getLong("route_id"), rs.getString("route_name"),
                rs.getObject("estimated_time_duration", Integer.class)));
    }

    /* ── Revenue for one bus ──────────────────────────────── */

    /**
     * Daily takings for a bus over the last {@code days} days, ending today.
     *
     * Only seats that were actually paid for count: a booking contributes when it
     * has a successful payment and has not been cancelled. Revenue is attributed
     * to the journey date rather than the payment date, so a day's figure is what
     * the bus earned for running that day.
     *
     * Days with no bookings are returned as zero rather than omitted, so the chart
     * shows a real gap instead of silently joining across it.
     */
    public BusRevenueSummary getRevenue(Long busId, int days) {
        int window = Math.min(Math.max(days, 1), 365);
        LocalDate today = LocalDate.now();
        LocalDate from = today.minusDays(window - 1L);

        String sql = """
                SELECT sb.journey_date AS journey_date,
                       SUM(sb.total_amount) AS revenue,
                       COUNT(*) AS seats_sold
                FROM seat_booking sb
                JOIN payment p ON p.payment_id = sb.payment_id
                WHERE sb.bus_id = ?
                  AND sb.status <> 'cancelled'
                  AND p.payment_status = 'success'
                  AND sb.journey_date BETWEEN ? AND ?
                GROUP BY sb.journey_date
                """;

        Map<LocalDate, BusRevenuePoint> byDate = new HashMap<>();
        jdbc.query(sql, rs -> {
            LocalDate date = rs.getDate("journey_date").toLocalDate();
            byDate.put(date, new BusRevenuePoint(
                    date.toString(),
                    toBigDecimal(rs.getObject("revenue")),
                    rs.getInt("seats_sold")));
        }, busId, java.sql.Date.valueOf(from), java.sql.Date.valueOf(today));

        List<BusRevenuePoint> points = new ArrayList<>(window);
        BigDecimal total = BigDecimal.ZERO;
        int seats = 0;
        for (int i = 0; i < window; i++) {
            LocalDate date = from.plusDays(i);
            BusRevenuePoint point = byDate.get(date);
            if (point == null) {
                point = new BusRevenuePoint(date.toString(), BigDecimal.ZERO, 0);
            }
            points.add(point);
            total = total.add(point.revenue());
            seats += point.seatsSold();
        }

        BigDecimal average = total.divide(BigDecimal.valueOf(window), 2, RoundingMode.HALF_UP);
        return new BusRevenueSummary(points, total, average, seats);
    }

    /* ── Seats sold on upcoming departures ────────────────── */

    /**
     * Seats already booked on each upcoming departure of a bus, covering today
     * through the next {@code days - 1} days. Keyed by journey date and time so the
     * caller can line each count up against the bus's scheduled departures.
     *
     * Cancelled bookings are excluded, but unpaid ones are not: a held seat is
     * unavailable regardless of whether its payment has settled yet.
     */
    public List<BusDepartureBookings> getUpcomingBookings(Long busId, int days) {
        int window = Math.min(Math.max(days, 1), 60);
        LocalDate today = LocalDate.now();
        LocalDate until = today.plusDays(window - 1L);

        String sql = """
                SELECT sb.journey_date AS journey_date,
                       sb.journey_time AS journey_time,
                       COUNT(*) AS booked_seats
                FROM seat_booking sb
                WHERE sb.bus_id = ?
                  AND sb.status <> 'cancelled'
                  AND sb.journey_date BETWEEN ? AND ?
                GROUP BY sb.journey_date, sb.journey_time
                ORDER BY sb.journey_date, sb.journey_time
                """;

        return jdbc.query(sql, (rs, rowNum) -> {
            Time time = rs.getTime("journey_time");
            return new BusDepartureBookings(
                    rs.getDate("journey_date").toLocalDate().toString(),
                    time == null ? null : time.toLocalTime().format(DateTimeFormatter.ofPattern("HH:mm")),
                    rs.getInt("booked_seats"));
        }, busId, java.sql.Date.valueOf(today), java.sql.Date.valueOf(until));
    }

    /* ── Helpers ──────────────────────────────────────────── */

    @SuppressWarnings("unchecked")
    private List<String> parseAmenities(Object obj) {
        if (obj == null)
            return List.of();
        try {
            return mapper.readValue(obj.toString(), new TypeReference<List<String>>() {
            });
        } catch (Exception e) {
            return List.of();
        }
    }

    private String toJson(List<String> list) {
        if (list == null || list.isEmpty())
            return "[]";
        try {
            return mapper.writeValueAsString(list);
        } catch (Exception e) {
            return "[]";
        }
    }

    private String formatTime(Object timeObj) {
        if (timeObj == null)
            return null;
        if (timeObj instanceof Time t)
            return t.toLocalTime().format(DateTimeFormatter.ofPattern("HH:mm"));
        if (timeObj instanceof LocalTime lt)
            return lt.format(DateTimeFormatter.ofPattern("HH:mm"));
        return timeObj.toString();
    }

    private LocalTime toLocalTime(Object timeObj) {
        if (timeObj == null)
            return null;
        if (timeObj instanceof Time t)
            return t.toLocalTime();
        if (timeObj instanceof LocalTime lt)
            return lt;
        try {
            return LocalTime.parse(timeObj.toString().substring(0, 5));
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * If the bus has a route assigned, compute end_time = start_time +
     * route.estimated_time_duration.
     * This ensures that whenever the route duration changes, the displayed end time
     * is always accurate.
     */
    private String computeEndTime(Object startObj, Object routeIdObj, Object durationObj, Object storedEndObj) {
        if (routeIdObj != null && startObj != null && durationObj != null) {
            int mins = ((Number) durationObj).intValue();
            if (mins > 0) {
                LocalTime start = toLocalTime(startObj);
                if (start != null) {
                    return start.plusMinutes(mins).format(DateTimeFormatter.ofPattern("HH:mm"));
                }
            }
        }
        return formatTime(storedEndObj);
    }

    /**
     * Return end time should respect explicitly stored values from admin edits.
     * If no value is stored, derive from route duration as fallback.
     */
    private String computeStoredOrDerivedEndTime(Object startObj, Object routeIdObj, Object durationObj, Object storedEndObj) {
        String stored = formatTime(storedEndObj);
        if (stored != null && !stored.isBlank()) {
            return stored;
        }
        return computeEndTime(startObj, routeIdObj, durationObj, storedEndObj);
    }

    /**
     * When saving a bus, look up the route's duration and compute end_time =
     * start_time + duration.
     * Falls back to the provided endTime when no route is assigned.
     */
    private String resolveEndTime(String startTime, Long routeId, String fallbackEndTime) {
        if (routeId != null && startTime != null && !startTime.isEmpty()) {
            try {
                Integer durationMins = jdbc.queryForObject(
                        "SELECT estimated_time_duration FROM route WHERE route_id = ?",
                        Integer.class, routeId);
                if (durationMins != null && durationMins > 0) {
                    return LocalTime.parse(startTime.length() > 5 ? startTime.substring(0, 5) : startTime)
                            .plusMinutes(durationMins)
                            .format(DateTimeFormatter.ofPattern("HH:mm"));
                }
            } catch (Exception ignored) {
            }
        }
        return fallbackEndTime;
    }

    private Long toLong(Object obj) {
        return obj != null ? ((Number) obj).longValue() : null;
    }

    private Long toLongNullable(Object obj) {
        return obj != null ? ((Number) obj).longValue() : null;
    }

    private int toInt(Object obj) {
        return obj != null ? ((Number) obj).intValue() : 0;
    }

    private Double toDouble(Object obj) {
        if (obj == null)
            return 0.0;
        return ((Number) obj).doubleValue();
    }

    private BigDecimal toBigDecimal(Object obj) {
        if (obj == null)
            return BigDecimal.ZERO;
        if (obj instanceof BigDecimal bd)
            return bd;
        return new BigDecimal(obj.toString());
    }

    private void setNullableLong(PreparedStatement ps, int index, Long value) throws java.sql.SQLException {
        if (value != null) {
            ps.setLong(index, value);
        } else {
            ps.setNull(index, java.sql.Types.BIGINT);
        }
    }

    private void setNullableTime(PreparedStatement ps, int index, String value) throws java.sql.SQLException {
        if (value != null && !value.isEmpty()) {
            ps.setString(index, value);
        } else {
            ps.setNull(index, java.sql.Types.TIME);
        }
    }
}
