package com.trackngo.aiagent.services;

import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;

@Service
@Slf4j
public class AiGroundingService {
    private final JdbcTemplate jdbc;

    public AiGroundingService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public String buildGroundingDigest(String userQuery) {
        String normalized = userQuery == null ? "" : userQuery.toLowerCase(Locale.ROOT);
        StringBuilder digest = new StringBuilder();
        appendPolicyKnowledge(digest, normalized);
        appendLiveRouteSnapshot(digest, normalized);
        return digest.toString();
    }

    private void appendPolicyKnowledge(StringBuilder digest, String normalizedQuery) {
        try {
            List<String> docs = jdbc.query("""
                    SELECT title, content
                    FROM ai_domain_knowledge
                    WHERE active = TRUE
                      AND (
                        LOWER(title) LIKE ?
                        OR LOWER(content) LIKE ?
                        OR tags LIKE '%all%'
                      )
                    ORDER BY priority DESC, updated_at DESC
                    LIMIT 4
                    """,
                    (rs, rowNum) -> rs.getString("title") + ": " + truncate(rs.getString("content"), 360),
                    "%" + keyword(normalizedQuery) + "%",
                    "%" + keyword(normalizedQuery) + "%");
            if (!docs.isEmpty()) {
                digest.append("Grounded TrackNGo knowledge:\n");
                docs.forEach(doc -> digest.append("- ").append(doc).append('\n'));
            }
        } catch (DataAccessException ex) {
            log.warn("Unable to read AI domain knowledge: {}", ex.getMessage());
        }
    }

    private void appendLiveRouteSnapshot(StringBuilder digest, String normalizedQuery) {
        if (!(normalizedQuery.contains("route")
                || normalizedQuery.contains("bus")
                || normalizedQuery.contains("book")
                || normalizedQuery.contains("seat")
                || normalizedQuery.contains("delay")
                || normalizedQuery.contains("eta"))) {
            return;
        }
        try {
            List<String> rows = jdbc.query("""
                    SELECT r.route_name, r.start_location, r.end_location, r.fee, COUNT(b.bus_id) AS active_buses
                    FROM route r
                    LEFT JOIN bus b ON b.route_id = r.route_id AND b.status = 'active'
                    WHERE r.is_active = TRUE
                    GROUP BY r.route_id, r.route_name, r.start_location, r.end_location, r.fee
                    ORDER BY active_buses DESC, r.route_name
                    LIMIT 6
                    """,
                    (rs, rowNum) -> "%s (%s to %s, base fare LKR %.2f, active buses %d)".formatted(
                            rs.getString("route_name"),
                            rs.getString("start_location"),
                            rs.getString("end_location"),
                            rs.getBigDecimal("fee"),
                            rs.getInt("active_buses")));
            if (!rows.isEmpty()) {
                digest.append("Current Sri Lankan route snapshot:\n");
                rows.forEach(row -> digest.append("- ").append(row).append('\n'));
            }
        } catch (DataAccessException ex) {
            log.warn("Unable to read route grounding snapshot: {}", ex.getMessage());
        }
    }

    private String keyword(String normalizedQuery) {
        if (normalizedQuery == null || normalizedQuery.isBlank()) {
            return "trackngo";
        }
        return normalizedQuery.split("\\s+")[0];
    }

    private String truncate(String value, int max) {
        if (value == null || value.length() <= max) {
            return value;
        }
        return value.substring(0, max - 3) + "...";
    }
}
