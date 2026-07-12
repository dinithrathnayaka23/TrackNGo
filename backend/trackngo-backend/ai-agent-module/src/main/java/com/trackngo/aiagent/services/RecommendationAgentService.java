package com.trackngo.aiagent.services;

import com.trackngo.aiagent.dto.RecommendationRequest;
import com.trackngo.aiagent.dto.RecommendationResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
@Slf4j
public class RecommendationAgentService {

    public RecommendationResponse generateRecommendations(RecommendationRequest request) {
        String context = request.travelContext();
        String preferences = request.preferences();
        List<String> recentTrips = request.recentTrips();

        List<String> recommendations = new ArrayList<>();
        if (context.contains("morning") || context.contains("commute")) {
            recommendations.add("Choose an early express route to avoid peak traffic.");
        }
        if (preferences.contains("quiet") || preferences.contains("peaceful")) {
            recommendations.add("Prefer quiet buses with fewer stops for a calmer ride.");
        }
        if (preferences.contains("budget") || preferences.contains("cheap")) {
            recommendations.add("Choose a budget-friendly fare option with the lowest cost for this trip.");
        }
        if (preferences.contains("comfort") || preferences.contains("wifi")) {
            recommendations.add("Look for buses that offer Wi-Fi and extra legroom.");
        }
        if (recentTrips != null && !recentTrips.isEmpty()) {
            recommendations.add("Based on your recent travel patterns, consider repeating your preferred route choices.");
        }

        if (recommendations.isEmpty()) {
            recommendations.add("Try the most reliable route with the best on-time performance.");
        }

        String reasoning = "Recommendations were tailored from your travel context, stated preferences, and recent trips.";
        String confidence = "medium";
        if (preferences.contains("budget") && preferences.contains("comfort")) {
            confidence = "high";
        }

        log.info("Generated {} recommendations for user {}", recommendations.size(), request.userId());
        return new RecommendationResponse(recommendations, reasoning, confidence);
    }
}
