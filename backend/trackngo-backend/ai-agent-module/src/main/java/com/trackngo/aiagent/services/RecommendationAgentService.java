package com.trackngo.aiagent.services;

import com.trackngo.aiagent.context.AgentExecutionContext;
import com.trackngo.aiagent.dto.RecommendationRequest;
import com.trackngo.aiagent.dto.RecommendationResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@Slf4j
public class RecommendationAgentService {

    private final JdbcTemplate jdbc;

    public RecommendationAgentService() {
        this.jdbc = null;
    }

    @Autowired
    public RecommendationAgentService(ObjectProvider<JdbcTemplate> jdbc) {
        this.jdbc = jdbc.getIfAvailable();
    }

    public RecommendationResponse generateRecommendations(RecommendationRequest request) {
        String context = request.travelContext();
        String preferences = request.preferences();
        List<String> recentTrips = recentTripsFromDatabase(request);

        List<String> recommendations = new ArrayList<>();
        if (context.contains("morning") || context.contains("commute")) {
            recommendations.add("Choose an early highway bus before the 7:30 AM Colombo peak, especially on Colombo Fort to Kandy or Galle corridors.");
        }
        if (preferences.contains("quiet") || preferences.contains("peaceful")) {
            recommendations.add("Prefer quiet buses with fewer stops for a calmer ride.");
        }
        if (preferences.contains("budget") || preferences.contains("cheap")) {
            recommendations.add("Choose a budget-friendly non-AC or standard highway option and compare the LKR fare before checkout.");
        }
        if (preferences.contains("comfort") || preferences.contains("wifi")) {
            recommendations.add("Look for buses with AC, Wi-Fi, and charging ports for longer Sri Lankan routes such as Colombo to Jaffna.");
        }
        if (recentTrips != null && !recentTrips.isEmpty()) {
            recommendations.add("Based on recent travel, consider these familiar routes again: " + String.join("; ", recentTrips.stream().distinct().limit(3).toList()) + ".");
        }
        appendPromotionRecommendation(recommendations, preferences);

        if (recommendations.isEmpty()) {
            recommendations.add("Try the most reliable active route with the best seat availability and driver rating.");
        }

        String reasoning = recentTrips.isEmpty()
                ? "Recommendations were tailored from your stated travel context and current Sri Lankan route data."
                : "Recommendations were tailored from your travel context, preferences, and TrackNGo booking history.";
        String confidence = "medium";
        if (preferences.contains("budget") && preferences.contains("comfort")) {
            confidence = "high";
        } else if (!recentTrips.isEmpty()) {
            confidence = "high";
        }

        log.info("Generated {} recommendations for user {}", recommendations.size(), request.userId());
        return new RecommendationResponse(recommendations, reasoning, confidence);
    }

    private List<String> recentTripsFromDatabase(RecommendationRequest request) {
        if (jdbc == null) {
            return request.recentTrips();
        }
        Long userId = parseUserId(request.userId());
        AgentExecutionContext.Context context = AgentExecutionContext.get();
        if (userId == null && context != null && context.hasUser()) {
            userId = context.userId();
        }
        if (userId == null) {
            return request.recentTrips();
        }
        try {
            return jdbc.queryForList("""
                    SELECT CONCAT(COALESCE(sb.from_stop, r.start_location), ' to ', COALESCE(sb.to_stop, r.end_location), ' on ', b.bus_number) AS trip_label
                    FROM seat_booking sb
                    JOIN route r ON r.route_id = sb.route_id
                    JOIN bus b ON b.bus_id = sb.bus_id
                    WHERE sb.passenger_id = ?
                    ORDER BY sb.journey_date DESC, sb.seat_booking_id DESC
                    LIMIT 5
                    """, String.class, userId);
        } catch (Exception ex) {
            log.warn("Unable to load recommendation history for user {}: {}", userId, ex.getMessage());
            return request.recentTrips();
        }
    }

    private void appendPromotionRecommendation(List<String> recommendations, String preferences) {
        if (jdbc == null) {
            return;
        }
        try {
            List<Map<String, Object>> promos = jdbc.queryForList("""
                    SELECT name, promo_code, discount_type, discount_value
                    FROM promotion
                    WHERE status = 'ACTIVE'
                      AND used_bookings < max_bookings
                    ORDER BY created_at DESC
                    LIMIT 1
                    """);
            if (!promos.isEmpty()) {
                Map<String, Object> promo = promos.get(0);
                String promoCode = promo.get("promo_code") == null ? "" : promo.get("promo_code").toString().trim();
                String promoName = promo.get("name") == null ? "current TrackNGo promotion" : promo.get("name").toString();
                if (promoCode.isBlank()) {
                    recommendations.add("Check the active promotion \"%s\" if eligible before paying in LKR.".formatted(promoName));
                } else {
                    recommendations.add("Use promo %s (%s) if eligible before paying in LKR.".formatted(promoCode, promoName));
                }
            } else if (preferences.contains("budget")) {
                recommendations.add("No active promo was found, so compare segment fares and pick the route with more available seats.");
            }
        } catch (Exception ignored) {
            if (preferences.contains("budget")) {
                recommendations.add("Check current promotions before checkout because LKR fares can change by segment.");
            }
        }
    }

    private Long parseUserId(String userId) {
        if (userId == null) {
            return null;
        }
        String digits = userId.replaceAll("[^0-9]", "");
        if (digits.isBlank()) {
            return null;
        }
        try {
            return Long.parseLong(digits);
        } catch (NumberFormatException ex) {
            return null;
        }
    }
}
