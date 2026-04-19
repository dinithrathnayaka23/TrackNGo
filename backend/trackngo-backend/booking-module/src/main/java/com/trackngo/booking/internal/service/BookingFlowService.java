package com.trackngo.booking.internal.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.trackngo.booking.api.dto.BookingFlowDtos.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.sql.Time;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class BookingFlowService {

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public BookingFlowService(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    /* ═══════════════════════════════════════════════════════════
       1. Search buses by from / to / date
       ═══════════════════════════════════════════════════════════ */
    public List<BusSearchResult> searchBuses(String from, String to, String date, String busCategory) {
        boolean filterCategory = busCategory != null && !busCategory.isBlank();
        String sql = """
            SELECT b.bus_id, b.bus_number, b.bus_type, b.bus_brand,
                   b.start_time, b.end_time, b.seat_capacity, b.amenities,
                   r.fee, r.route_id, r.route_name,
                   d.average_rating,
                   CONCAT(u.first_name, ' ', u.last_name) AS driver_name
            FROM bus b
            JOIN route r ON b.route_id = r.route_id
            LEFT JOIN driver d ON b.driver_id = d.driver_id
            LEFT JOIN `user` u ON d.driver_id = u.user_id
            WHERE LOWER(r.start_location) LIKE ?
              AND LOWER(r.end_location) LIKE ?
              AND b.status = 'active'
              AND r.is_active = 1
            """ + (filterCategory ? "  AND b.bus_type = ?\n" : "") + """
            ORDER BY b.start_time
            """;

        String fromPattern = "%" + from.trim().toLowerCase() + "%";
        String toPattern = "%" + to.trim().toLowerCase() + "%";

        List<Map<String, Object>> rows = filterCategory
            ? jdbc.queryForList(sql, fromPattern, toPattern, busCategory.trim().toLowerCase())
            : jdbc.queryForList(sql, fromPattern, toPattern);

        List<BusSearchResult> results = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Long busId = ((Number) row.get("bus_id")).longValue();
            int capacity = ((Number) row.get("seat_capacity")).intValue();

            int bookedCount = countBookedSeats(busId, date);
            int available = Math.max(0, capacity - bookedCount);

            List<String> amenities = parseAmenities(row.get("amenities"));

            results.add(new BusSearchResult(
                    busId,
                    (String) row.get("bus_number"),
                    (String) row.get("bus_type"),
                    (String) row.get("bus_brand"),
                    formatTime(row.get("start_time")),
                    formatTime(row.get("end_time")),
                    capacity,
                    available,
                    amenities,
                    toBigDecimal(row.get("fee")),
                    (String) row.get("driver_name"),
                    toDouble(row.get("average_rating"))
            ));
        }
        return results;
    }

    /* ═══════════════════════════════════════════════════════════
       2. Bus details (route stops, driver, amenities)
       ═══════════════════════════════════════════════════════════ */
    public BusDetailResult getBusDetails(Long busId) {
        String busSql = """
            SELECT b.bus_id, b.bus_number, b.bus_type, b.bus_brand,
                   b.start_time, b.end_time, b.seat_capacity, b.amenities,
                   r.fee, r.route_id, r.route_name,
                   d.average_rating, d.phone_number AS driver_phone, d.profile_photo,
                   CONCAT(u.first_name, ' ', u.last_name) AS driver_name
            FROM bus b
            JOIN route r ON b.route_id = r.route_id
            LEFT JOIN driver d ON b.driver_id = d.driver_id
            LEFT JOIN `user` u ON d.driver_id = u.user_id
            WHERE b.bus_id = ?
            """;

        Map<String, Object> row = jdbc.queryForMap(busSql, busId);

        Long routeId = ((Number) row.get("route_id")).longValue();

        String stopsSql = """
            SELECT rs.name, rs.estimated_arrival_mins, rs.priority
            FROM route_stop rs
            WHERE rs.route_id = ?
            ORDER BY rs.priority
            """;
        List<Map<String, Object>> stopRows = jdbc.queryForList(stopsSql, routeId);

        LocalTime busStart = toLocalTime(row.get("start_time"));

        List<BusDetailResult.RouteStopInfo> stops = new ArrayList<>();
        for (Map<String, Object> s : stopRows) {
            int mins = s.get("estimated_arrival_mins") != null
                    ? ((Number) s.get("estimated_arrival_mins")).intValue() : 0;
            LocalTime eta = busStart.plusMinutes(mins);
            String etaStr = eta.format(DateTimeFormatter.ofPattern("hh:mm a"));
            stops.add(new BusDetailResult.RouteStopInfo(
                    (String) s.get("name"),
                    etaStr,
                    ((Number) s.get("priority")).intValue()
            ));
        }

        return new BusDetailResult(
                busId,
                (String) row.get("bus_number"),
                (String) row.get("bus_type"),
                (String) row.get("bus_brand"),
                formatTime(row.get("start_time")),
                formatTime(row.get("end_time")),
                ((Number) row.get("seat_capacity")).intValue(),
                parseAmenities(row.get("amenities")),
                toBigDecimal(row.get("fee")),
                (String) row.get("route_name"),
                stops,
                row.get("driver_name") != null
                    ? new BusDetailResult.DriverInfo(
                            (String) row.get("driver_name"),
                            (String) row.get("driver_phone"),
                            toDouble(row.get("average_rating")),
                            (String) row.get("profile_photo"))
                    : new BusDetailResult.DriverInfo("Unassigned", null, 0.0, null)
        );
    }

    /* ═══════════════════════════════════════════════════════════
       3. Seat layout (from DB or generate default)
       ═══════════════════════════════════════════════════════════ */
    public List<SeatLayoutRow> getSeatLayout(Long busId) {
        String sql = "SELECT seat_label, row_num, position_group, position_index " +
                     "FROM seat_layout WHERE bus_id = ? ORDER BY row_num, position_index";
        List<Map<String, Object>> rows = jdbc.queryForList(sql, busId);

        if (rows.isEmpty()) {
            int capacity = jdbc.queryForObject(
                    "SELECT seat_capacity FROM bus WHERE bus_id = ?", Integer.class, busId);
            return generateDefaultLayout(capacity);
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
                    back
            ));
        }
        return result;
    }

    /* ═══════════════════════════════════════════════════════════
       4. Booked seats for a bus + date
       ═══════════════════════════════════════════════════════════ */
    public List<String> getBookedSeats(Long busId, String date) {
        String sql = "SELECT seat_number FROM seat_booking " +
                     "WHERE bus_id = ? AND journey_date = ? AND status != 'cancelled'";
        List<String> seatStrings = jdbc.queryForList(sql, String.class, busId, date);

        return seatStrings.stream()
                .flatMap(s -> Arrays.stream(s.split(",")))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toList());
    }

    /* ═══════════════════════════════════════════════════════════
       4b. Blocked seats for a bus
       ═══════════════════════════════════════════════════════════ */
    public List<String> getBlockedSeats(Long busId) {
        String sql = "SELECT seat_label FROM seat_layout WHERE bus_id = ? AND blocked = true";
        return jdbc.queryForList(sql, String.class, busId);
    }

    /* ═══════════════════════════════════════════════════════════
       5. Create booking + payment (transactional)
       ═══════════════════════════════════════════════════════════ */
    @Transactional
    public BookingConfirmationResult createBooking(CreateBookingRequest req) {

        // 0) Ensure a passenger record exists for this user (FK requirement)
        ensurePassengerExists(req.passengerId());

        String txnId = "TXN-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        String bookingRef = "BK-" + req.journeyDate().replace("-", "")
                + "-" + UUID.randomUUID().toString().substring(0, 4).toUpperCase();

        // 1) Insert payment
        KeyHolder paymentKeyHolder = new GeneratedKeyHolder();
        jdbc.update(con -> {
            PreparedStatement ps = con.prepareStatement(
                    "INSERT INTO payment (transaction_id, payment_method, payment_status, amount) VALUES (?,?,?,?)",
                    Statement.RETURN_GENERATED_KEYS
            );
            ps.setString(1, txnId);
            ps.setString(2, req.paymentMethod() != null ? req.paymentMethod() : "stripe");
            ps.setString(3, "success");
            ps.setBigDecimal(4, req.totalAmount());
            return ps;
        }, paymentKeyHolder);
        Long paymentId = paymentKeyHolder.getKey().longValue();

        // 2) Resolve route_id from bus
        Long routeId = jdbc.queryForObject("SELECT route_id FROM bus WHERE bus_id = ?", Long.class, req.busId());

        // 3) Insert seat_booking
        String seatNumbers = String.join(",", req.seatNumbers());
        jdbc.update(
                "INSERT INTO seat_booking (booking_reference, journey_date, journey_time, seat_number, " +
                "special_request, total_amount, status, passenger_id, bus_id, route_id, payment_id) " +
                "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                bookingRef,
                req.journeyDate(),
                req.journeyTime(),
                seatNumbers,
                req.specialRequest(),
                req.totalAmount(),
                "confirmed",
                req.passengerId(),
                req.busId(),
                routeId,
                paymentId
        );

        // 4) Look up bus info for response
        Map<String, Object> bus = jdbc.queryForMap(
                "SELECT b.bus_number, r.start_location, r.end_location " +
                "FROM bus b JOIN route r ON b.route_id = r.route_id WHERE b.bus_id = ?",
                req.busId()
        );

        return new BookingConfirmationResult(
                bookingRef,
                "confirmed",
                txnId,
                seatNumbers,
                req.totalAmount(),
                (String) bus.get("bus_number"),
                (String) bus.get("start_location"),
                (String) bus.get("end_location"),
                req.journeyDate(),
                req.journeyTime()
        );
    }

    /* ═══════════════════════════════════════════════════════════
       6. Get booking by reference
       ═══════════════════════════════════════════════════════════ */
    public BookingConfirmationResult getBookingByRef(String bookingRef) {
        String sql = """
            SELECT sb.booking_reference, sb.status, sb.seat_number, sb.total_amount,
                   sb.journey_date, sb.journey_time,
                   b.bus_number, r.start_location, r.end_location,
                   p.transaction_id
            FROM seat_booking sb
            JOIN bus b ON sb.bus_id = b.bus_id
            JOIN route r ON sb.route_id = r.route_id
            LEFT JOIN payment p ON sb.payment_id = p.payment_id
            WHERE sb.booking_reference = ?
            """;
        Map<String, Object> row = jdbc.queryForMap(sql, bookingRef);

        return new BookingConfirmationResult(
                (String) row.get("booking_reference"),
                (String) row.get("status"),
                (String) row.get("transaction_id"),
                (String) row.get("seat_number"),
                toBigDecimal(row.get("total_amount")),
                (String) row.get("bus_number"),
                (String) row.get("start_location"),
                (String) row.get("end_location"),
                row.get("journey_date") != null ? row.get("journey_date").toString() : null,
                formatTime(row.get("journey_time"))
        );
    }

    /* ═══════════════════════════════════════════════════════════
       7. Cancel booking by reference
       ═══════════════════════════════════════════════════════════ */
    @Transactional
    public void cancelBooking(String bookingRef) {
        int updated = jdbc.update(
            "UPDATE seat_booking SET status = 'cancelled' WHERE booking_reference = ? AND status = 'confirmed'",
            bookingRef
        );
        if (updated == 0) {
            throw new RuntimeException("Booking not found or already cancelled");
        }
    }

    /* ═══════════════════════════════════════════════════════════
       HELPERS
       ═══════════════════════════════════════════════════════════ */

    private int countBookedSeats(Long busId, String date) {
        String sql = "SELECT COALESCE(SUM(LENGTH(seat_number) - LENGTH(REPLACE(seat_number, ',', '')) + 1), 0) " +
                     "FROM seat_booking WHERE bus_id = ? AND journey_date = ? AND status != 'cancelled'";
        return jdbc.queryForObject(sql, Integer.class, busId, date);
    }

    private List<SeatLayoutRow> generateDefaultLayout(int seatCapacity) {
        List<SeatLayoutRow> rows = new ArrayList<>();
        int lastRowSize = 5;
        if (seatCapacity <= 20) lastRowSize = 3;
        else if (seatCapacity <= 30) lastRowSize = 4;

        int regularSeats = seatCapacity - lastRowSize;
        if (regularSeats % 4 != 0) {
            lastRowSize = seatCapacity % 4 == 0 ? 4 : (seatCapacity % 4) + 4;
            if (lastRowSize > seatCapacity) lastRowSize = seatCapacity;
            regularSeats = seatCapacity - lastRowSize;
        }
        int regularRows = regularSeats / 4;

        for (int r = 1; r <= regularRows; r++) {
            rows.add(new SeatLayoutRow(
                    r,
                    List.of(r + "A", r + "B"),
                    List.of(r + "C", r + "D"),
                    null
            ));
        }

        if (lastRowSize > 0) {
            int lastRowNum = regularRows + 1;
            String[] cols = {"A", "B", "C", "D", "E", "F"};
            List<String> lastSeats = new ArrayList<>();
            for (int i = 0; i < lastRowSize && i < cols.length; i++) {
                lastSeats.add(lastRowNum + cols[i]);
            }
            rows.add(new SeatLayoutRow(lastRowNum, List.of(), List.of(), lastSeats));
        }

        return rows;
    }

    @SuppressWarnings("unchecked")
    private List<String> parseAmenities(Object amenitiesObj) {
        if (amenitiesObj == null) return List.of();
        try {
            String json = amenitiesObj.toString();
            return mapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private String formatTime(Object timeObj) {
        if (timeObj == null) return "";
        if (timeObj instanceof Time t) {
            return t.toLocalTime().format(DateTimeFormatter.ofPattern("HH:mm"));
        }
        if (timeObj instanceof LocalTime lt) {
            return lt.format(DateTimeFormatter.ofPattern("HH:mm"));
        }
        return timeObj.toString();
    }

    private LocalTime toLocalTime(Object timeObj) {
        if (timeObj instanceof Time t) return t.toLocalTime();
        if (timeObj instanceof LocalTime lt) return lt;
        if (timeObj instanceof String s) return LocalTime.parse(s);
        return LocalTime.of(0, 0);
    }

    private BigDecimal toBigDecimal(Object obj) {
        if (obj == null) return BigDecimal.ZERO;
        if (obj instanceof BigDecimal bd) return bd;
        return new BigDecimal(obj.toString());
    }

    private Double toDouble(Object obj) {
        if (obj == null) return 0.0;
        if (obj instanceof Number n) return n.doubleValue();
        return Double.parseDouble(obj.toString());
    }

    private void ensurePassengerExists(Long userId) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM passenger WHERE passenger_id = ?", Integer.class, userId);
        if (count == null || count == 0) {
            String placeholder = "000-" + userId;
            jdbc.update("INSERT INTO passenger (passenger_id, mobile_number, status) VALUES (?, ?, 'active')",
                    userId, placeholder);
        }
    }
}
