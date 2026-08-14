package com.trackngo.aiagent.dto;

import java.util.List;
import java.util.Locale;

public record RecommendationRequest(String userId, String travelContext, String preferences, List<String> recentTrips) {

    public RecommendationRequest {
        userId = userId == null ? "anonymous" : userId.trim();
        travelContext = travelContext == null ? "" : travelContext.trim();
        preferences = preferences == null ? "" : preferences.trim();
        recentTrips = recentTrips == null ? List.of() : List.copyOf(recentTrips);
        travelContext = travelContext.toLowerCase(Locale.ROOT);
        preferences = preferences.toLowerCase(Locale.ROOT);
    }
}
