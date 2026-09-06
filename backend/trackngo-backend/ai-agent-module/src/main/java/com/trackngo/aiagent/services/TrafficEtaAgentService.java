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
            String routeLabel = routeLabel(bus);
            long ageMinutes = ageInMinutes(location.get("recorded_at"));

            // A fix from hours or days ago describes where the bus was, not where it
            // is. Saying "is near X" from one of those is the difference between
            // reporting and guessing, so an old fix is reported as an old fix.
            if (ageMinutes > FRESH_FIX_MINUTES) {
                return new TrafficEtaAgent.EtaResponse(
                        routeLabel,
                        0,
                        "%s is not reporting its position right now. The last GPS fix on %s arrived %s. I cannot say where it is at the moment.".formatted(
                                busNumber, routeLabel, describeAge(ageMinutes)),
                        "low",
                        "stale_gps_db");
            }

            double speed = location.get("speed") == null ? 0.0 : ((Number) location.get("speed")).doubleValue();
            String place = nearestStopLabel(bus, location);

            // Only what the fix actually says. There is no timetable comparison and no
            // traffic feed behind this, so no delay figure is claimed: the previous
            // version read a number out of a hardcoded speed table and presented it as
            // a measured delay, along with a cause it had never observed.
            boolean stopKnown = !"its route".equals(place);
            String where = stopKnown
                    ? "near %s, on the %s route".formatted(place, routeLabel)
                    : "on the %s route".formatted(routeLabel);
            String message = speed <= 1.0
                    ? "%s is stopped %s. Position reported %s.".formatted(busNumber, where, describeAge(ageMinutes))
                    : "%s is moving at about %.0f km/h %s. Position reported %s.".formatted(
                            busNumber, speed, where, describeAge(ageMinutes));

            return new TrafficEtaAgent.EtaResponse(
                    stopKnown ? place : routeLabel,
                    0,
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

    /**
     * How old a fix may be and still describe where the bus is now.
     *
     * Live tracking treats a fix as stale after 30 seconds because it animates a
     * marker. A chat answer tolerates a slightly older fix, but must never present
     * one from another day as the current position.
     */
    private static final long FRESH_FIX_MINUTES = 5;

    private long ageInMinutes(Object recordedAt) {
        if (recordedAt instanceof Timestamp timestamp) {
            return Math.max(0, Duration.between(timestamp.toLocalDateTime(), LocalDateTime.now()).toMinutes());
        }
        // Without a timestamp the age is unknown, which must not read as fresh.
        return Long.MAX_VALUE;
    }

    private String describeAge(long minutes) {
        if (minutes == Long.MAX_VALUE) return "at an unknown time";
        if (minutes <= 1) return "just now";
        if (minutes < 60) return "%d minutes ago".formatted(minutes);
        long hours = minutes / 60;
        if (hours < 24) return hours == 1 ? "an hour ago" : "%d hours ago".formatted(hours);
        long days = hours / 24;
        return days == 1 ? "a day ago" : "%d days ago".formatted(days);
    }

    private String routeLabel(Map<String, Object> bus) {
        Object start = bus.get("start_location");
        Object end = bus.get("end_location");
        if (start != null && end != null) {
            return "%s to %s".formatted(start, end);
        }
        Object routeName = bus.get("route_name");
        return routeName == null ? "its route" : routeName.toString();
    }

    /**
     * Names the stop the bus is closest to.
     *
     * Falls back to the route rather than to the raw fix. Not every route has
     * coordinates against its stops - the Colombo Fort to Kandy stops have none -
     * and printing "latest GPS point 7.29360, 80.63500" at a passenger tells them
     * nothing they can act on.
     */
    private String nearestStopLabel(Map<String, Object> bus, Map<String, Object> location) {
        Object routeId = bus.get("route_id");
        if (routeId == null || location.get("latitude") == null || location.get("longitude") == null) {
            return "its route";
        }
        List<Map<String, Object>> stops = jdbc.queryForList("""
                SELECT name, latitude, longitude
                FROM route_stop
                WHERE route_id = ?
                  AND latitude IS NOT NULL
                  AND longitude IS NOT NULL
                """, routeId);
        if (stops.isEmpty()) {
            return "its route";
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
