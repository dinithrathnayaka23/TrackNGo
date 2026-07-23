package com.trackngo.aiagent.services;

import com.trackngo.aiagent.agents.TrafficEtaAgent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@Slf4j
public class TrafficEtaAgentService {

    private final JdbcTemplate jdbc;

    public TrafficEtaAgentService() {
        this.jdbc = null;
    }

    @Autowired
    public TrafficEtaAgentService(ObjectProvider<JdbcTemplate> jdbc) {
        this.jdbc = jdbc.getIfAvailable();
    }

    public TrafficEtaAgent.EtaResponse getLiveEta(TrafficEtaAgent.EtaRequest request) {
        log.info("Fetching ETA and traffic data for bus: {}", request.busId());

        if (jdbc == null) {
            return new TrafficEtaAgent.EtaResponse(
                    "Kadawatha interchange corridor",
                    15,
                    "Bus is delayed by 15 minutes due to heavy A1/Kandy Road traffic.",
                    "low",
                    "local_fallback");
        }

        try {
            Map<String, Object> bus = findBus(request.busId());
            if (bus.isEmpty()) {
                return new TrafficEtaAgent.EtaResponse(
                        "Unknown",
                        0,
                        "I could not find that bus in the TrackNGo fleet. Try a bus number such as NB-0012 or a numeric bus id.",
                        "high",
                        "fleet_db");
            }

            String busNumber = (String) bus.get("bus_number");
            List<Map<String, Object>> locations = jdbc.queryForList("""
                    SELECT latitude, longitude, speed, recorded_at
                    FROM bus_locations
                    WHERE bus_number = ?
                    ORDER BY recorded_at DESC
                    LIMIT 1
                    """, busNumber);

            if (locations.isEmpty()) {
                String route = "%s to %s".formatted(bus.get("start_location"), bus.get("end_location"));
                int routeMins = bus.get("estimated_time_duration") == null
                        ? 0
                        : ((Number) bus.get("estimated_time_duration")).intValue();
                return new TrafficEtaAgent.EtaResponse(
                        route,
                        0,
                        "No live GPS ping is available for %s. Scheduled route duration is about %d minutes.".formatted(busNumber, routeMins),
                        "medium",
                        "schedule_db");
            }

            Map<String, Object> location = locations.get(0);
            double speed = location.get("speed") == null ? 0.0 : ((Number) location.get("speed")).doubleValue();
            int delay = estimateDelay(speed, location.get("recorded_at"));
            String nearestStop = nearestStopLabel(bus, location);
            String message = delay > 0
                    ? "%s is delayed by about %d minutes near %s. Likely congestion on %s.".formatted(busNumber, delay, nearestStop, bus.get("route_name"))
                    : "%s is moving normally near %s on %s.".formatted(busNumber, nearestStop, bus.get("route_name"));

            return new TrafficEtaAgent.EtaResponse(
                    nearestStop,
                    delay,
                    message,
                    "medium",
                    "live_gps_db");
        } catch (Exception ex) {
            log.warn("ETA lookup failed for {}: {}", request.busId(), ex.getMessage());
            return new TrafficEtaAgent.EtaResponse(
                    "Sri Lankan road network",
                    10,
                    "I could not read live GPS data right now. Please check the live map for the latest bus marker.",
                    "low",
                    "error");
        }
    }

    private Map<String, Object> findBus(String busId) {
        String value = busId == null ? "" : busId.trim();
        String digits = value.replaceAll("[^0-9]", "");
        List<Map<String, Object>> rows;
        if (!digits.isBlank() && value.toLowerCase(Locale.ROOT).startsWith("bus")) {
            rows = jdbc.queryForList(busQuery() + " WHERE b.bus_id = ? LIMIT 1", Long.parseLong(digits));
        } else if (!digits.isBlank() && value.matches("\\d+")) {
            rows = jdbc.queryForList(busQuery() + " WHERE b.bus_id = ? LIMIT 1", Long.parseLong(digits));
        } else {
            rows = jdbc.queryForList(busQuery() + " WHERE LOWER(b.bus_number) = LOWER(?) LIMIT 1", value);
        }
        return rows.isEmpty() ? Map.of() : rows.get(0);
    }

    private String busQuery() {
        return """
                SELECT b.bus_id, b.bus_number, r.route_id, r.route_name, r.start_location, r.end_location,
                       r.estimated_time_duration
                FROM bus b
                LEFT JOIN route r ON r.route_id = b.route_id
                """;
    }

    private int estimateDelay(double speed, Object recordedAt) {
        int delay = speed <= 0 ? 12 : speed < 25 ? 25 : speed < 40 ? 15 : speed < 55 ? 8 : 0;
        if (recordedAt instanceof Timestamp timestamp) {
            long ageMins = Duration.between(timestamp.toLocalDateTime(), LocalDateTime.now()).toMinutes();
            if (ageMins > 10) {
                delay += 5;
            }
        }
        return delay;
    }

    private String nearestStopLabel(Map<String, Object> bus, Map<String, Object> location) {
        Object routeId = bus.get("route_id");
        if (routeId == null || location.get("latitude") == null || location.get("longitude") == null) {
            return "latest GPS point %.5f, %.5f".formatted(
                    toDouble(location.get("latitude")),
                    toDouble(location.get("longitude")));
        }
        List<Map<String, Object>> stops = jdbc.queryForList("""
                SELECT name, latitude, longitude
                FROM route_stop
                WHERE route_id = ?
                  AND latitude IS NOT NULL
                  AND longitude IS NOT NULL
                """, routeId);
        if (stops.isEmpty()) {
            return "latest GPS point %.5f, %.5f".formatted(
                    toDouble(location.get("latitude")),
                    toDouble(location.get("longitude")));
        }
        double lat = toDouble(location.get("latitude"));
        double lng = toDouble(location.get("longitude"));
        Map<String, Object> nearest = stops.stream()
                .min((left, right) -> Double.compare(distance(lat, lng, left), distance(lat, lng, right)))
                .orElse(stops.get(0));
        return (String) nearest.get("name");
    }

    private double distance(double lat, double lng, Map<String, Object> stop) {
        double stopLat = toDouble(stop.get("latitude"));
        double stopLng = toDouble(stop.get("longitude"));
        double latDelta = lat - stopLat;
        double lngDelta = lng - stopLng;
        return Math.sqrt(latDelta * latDelta + lngDelta * lngDelta);
    }

    private double toDouble(Object value) {
        if (value instanceof BigDecimal bd) {
            return bd.doubleValue();
        }
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        return value == null ? 0.0 : Double.parseDouble(value.toString());
    }
}
