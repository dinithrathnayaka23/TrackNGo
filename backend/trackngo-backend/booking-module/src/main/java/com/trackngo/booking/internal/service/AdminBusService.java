package com.trackngo.booking.internal.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.trackngo.booking.api.dto.AdminBusDtos.*;
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
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class AdminBusService {

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public AdminBusService(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
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
                   b.start_time, b.end_time, b.registration_number, b.insurance_exp_date,
                   b.driver_id, b.route_id,
                   CONCAT(u.first_name, ' ', u.last_name) AS driver_name,
                   r.route_name
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
                    formatTime(row.get("end_time")),
                    (String) row.get("registration_number"),
                    row.get("insurance_exp_date") != null ? row.get("insurance_exp_date").toString() : null
            ));
        }
        return results;
    }

    /* ── Get single bus detail ────────────────────────────── */
    public BusDetail getBusDetail(Long busId) {
        String sql = """
            SELECT b.bus_id, b.bus_number, b.bus_brand, b.seat_capacity,
                   b.bus_type, b.bus_condition, b.status, b.amenities,
                   b.start_time, b.end_time, b.registration_number, b.insurance_exp_date,
                   b.driver_id, b.route_id,
                   CONCAT(u.first_name, ' ', u.last_name) AS driver_name,
                   d.phone_number AS driver_phone, d.average_rating,
                   r.route_name, r.fee
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
                formatTime(row.get("end_time")),
                (String) row.get("registration_number"),
                row.get("insurance_exp_date") != null ? row.get("insurance_exp_date").toString() : null,
                toLongNullable(row.get("driver_id")),
                (String) row.get("driver_name"),
                (String) row.get("driver_phone"),
                toDouble(row.get("average_rating")),
                toLongNullable(row.get("route_id")),
                (String) row.get("route_name"),
                toBigDecimal(row.get("fee"))
        );
    }

    /* ── Create bus ───────────────────────────────────────── */
    public Long createBus(SaveBusRequest req) {
        String amenitiesJson = toJson(req.amenities());
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbc.update(con -> {
            PreparedStatement ps = con.prepareStatement(
                    "INSERT INTO bus (bus_number, bus_brand, seat_capacity, bus_type, bus_condition, " +
                    "status, amenities, start_time, end_time, registration_number, insurance_exp_date, " +
                    "driver_id, route_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
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
            ps.setString(10, req.registrationNumber());
            ps.setString(11, req.insuranceExpDate());
            setNullableLong(ps, 12, req.driverId());
            setNullableLong(ps, 13, req.routeId());
            return ps;
        }, keyHolder);
        return keyHolder.getKey().longValue();
    }

    /* ── Update bus ───────────────────────────────────────── */
    public void updateBus(Long busId, SaveBusRequest req) {
        String amenitiesJson = toJson(req.amenities());
        jdbc.update(
                "UPDATE bus SET bus_number=?, bus_brand=?, seat_capacity=?, bus_type=?, bus_condition=?, " +
                "status=?, amenities=?, start_time=?, end_time=?, registration_number=?, insurance_exp_date=?, " +
                "driver_id=?, route_id=? WHERE bus_id=?",
                req.busNumber(), req.busBrand(), req.seatCapacity(), req.busType(), req.busCondition(),
                req.status(), amenitiesJson,
                req.startTime() != null && !req.startTime().isEmpty() ? req.startTime() : null,
                req.endTime() != null && !req.endTime().isEmpty() ? req.endTime() : null,
                req.registrationNumber(), req.insuranceExpDate(),
                req.driverId(), req.routeId(), busId
        );
    }

    /* ── Delete bus ───────────────────────────────────────── */
    @Transactional
    public void deleteBus(Long busId) {
        jdbc.update("DELETE FROM seat_layout WHERE bus_id = ?", busId);
        jdbc.update("DELETE FROM bus WHERE bus_id = ?", busId);
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
                    back
            ));
        }
        return result;
    }

    /* ── Save seat layout ─────────────────────────────────── */
    @Transactional
    public void saveSeatLayout(Long busId, SaveSeatLayoutRequest req) {
        jdbc.update("DELETE FROM seat_layout WHERE bus_id = ?", busId);

        if (req.rows() == null || req.rows().isEmpty()) return;

        Set<String> blockedLabels = req.blockedSeats() != null
                ? new HashSet<>(req.blockedSeats())
                : Set.of();

        String insertSql = "INSERT INTO seat_layout (bus_id, seat_label, row_num, position_group, position_index, blocked) " +
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

    /* ── Dropdown options ─────────────────────────────────── */
    public List<DriverOption> getDriverOptions() {
        String sql = """
            SELECT d.driver_id, CONCAT(u.first_name, ' ', u.last_name) AS name
            FROM driver d
            JOIN `user` u ON d.driver_id = u.user_id
            ORDER BY name
            """;
        return jdbc.query(sql, (rs, rowNum) ->
                new DriverOption(rs.getLong("driver_id"), rs.getString("name")));
    }

    public List<RouteOption> getRouteOptions() {
        String sql = "SELECT route_id, route_name FROM route WHERE is_active = 1 ORDER BY route_name";
        return jdbc.query(sql, (rs, rowNum) ->
                new RouteOption(rs.getLong("route_id"), rs.getString("route_name")));
    }

    /* ── Helpers ──────────────────────────────────────────── */

    @SuppressWarnings("unchecked")
    private List<String> parseAmenities(Object obj) {
        if (obj == null) return List.of();
        try {
            return mapper.readValue(obj.toString(), new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private String toJson(List<String> list) {
        if (list == null || list.isEmpty()) return "[]";
        try {
            return mapper.writeValueAsString(list);
        } catch (Exception e) {
            return "[]";
        }
    }

    private String formatTime(Object timeObj) {
        if (timeObj == null) return null;
        if (timeObj instanceof Time t) return t.toLocalTime().format(DateTimeFormatter.ofPattern("HH:mm"));
        if (timeObj instanceof LocalTime lt) return lt.format(DateTimeFormatter.ofPattern("HH:mm"));
        return timeObj.toString();
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
        if (obj == null) return 0.0;
        return ((Number) obj).doubleValue();
    }

    private BigDecimal toBigDecimal(Object obj) {
        if (obj == null) return BigDecimal.ZERO;
        if (obj instanceof BigDecimal bd) return bd;
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
