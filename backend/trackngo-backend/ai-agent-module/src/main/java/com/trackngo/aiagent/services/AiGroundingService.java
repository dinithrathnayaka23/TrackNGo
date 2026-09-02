package com.trackngo.aiagent.services;

import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@Slf4j
public class AiGroundingService {

    /** Question and filler words that carry no signal about which document is wanted. */
    private static final Set<String> STOP_WORDS = Set.of(
            "the", "and", "for", "you", "your", "are", "was", "were", "with", "that", "this",
            "what", "when", "where", "which", "who", "why", "how", "can", "could", "would",
            "should", "does", "did", "have", "has", "had", "get", "got", "there", "about",
            "into", "from", "any", "all", "please", "tell", "give", "want", "need", "trackngo");

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
        List<String> terms = searchTerms(normalizedQuery);

        // Documents are ranked by how many of the question's own words they mention,
        // so asking about refunds surfaces the refund policy rather than whichever
        // document happens to carry the highest priority. Retrieval used to key on
        // the query's first word alone, which for "what is the refund policy" meant
        // searching for "what" and falling back to the catch-all tag.
        StringBuilder relevance = new StringBuilder("0");
        List<Object> args = new ArrayList<>();
        for (String term : terms) {
            relevance.append(" + (LOWER(title) LIKE ?) * 3")
                    .append(" + (LOWER(tags) LIKE ?) * 2")
                    .append(" + (LOWER(content) LIKE ?)");
            String like = "%" + term + "%";
            args.add(like);
            args.add(like);
            args.add(like);
        }

        String sql = """
                SELECT title, content, (%s) AS relevance
                FROM ai_domain_knowledge
                WHERE active = TRUE
                ORDER BY relevance DESC, priority DESC, updated_at DESC
                LIMIT 4
                """.formatted(relevance);

        try {
            List<String> docs = jdbc.query(
                    sql,
                    (rs, rowNum) -> rs.getString("title") + ": " + truncate(rs.getString("content"), 360),
                    args.toArray());
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

    /**
     * The words from a question worth searching on. Anything shorter than three
     * characters and the common question and filler words are dropped, because
     * matching on "what" or "the" scores every document alike and tells us nothing.
     */
    private List<String> searchTerms(String normalizedQuery) {
        if (normalizedQuery == null || normalizedQuery.isBlank()) {
            return List.of("trackngo");
        }
        List<String> terms = Arrays.stream(normalizedQuery.split("[^a-z0-9]+"))
                .filter(word -> word.length() > 2)
                .filter(word -> !STOP_WORDS.contains(word))
                .distinct()
                .limit(8)
                .toList();
        return terms.isEmpty() ? List.of("trackngo") : terms;
    }

    private String truncate(String value, int max) {
        if (value == null || value.length() <= max) {
            return value;
        }
        return value.substring(0, max - 3) + "...";
    }
}
