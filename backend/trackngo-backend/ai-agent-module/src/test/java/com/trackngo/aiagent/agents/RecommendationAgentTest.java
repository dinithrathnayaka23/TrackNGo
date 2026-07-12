package com.trackngo.aiagent.agents;

import com.trackngo.aiagent.dto.RecommendationRequest;
import com.trackngo.aiagent.dto.RecommendationResponse;
import com.trackngo.aiagent.services.RecommendationAgentService;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class RecommendationAgentTest {

    private final RecommendationAgentService recommendationAgentService = new RecommendationAgentService();

    @Test
    void shouldCreateTailoredSuggestions() {
        RecommendationRequest request = new RecommendationRequest(
                "user-002",
                "morning commute",
                "quiet budget comfort",
                List.of("Route A", "Route B")
        );

        RecommendationResponse response = recommendationAgentService.generateRecommendations(request);

        assertNotNull(response);
        assertFalse(response.recommendations().isEmpty());
        assertTrue(response.recommendations().stream().anyMatch(item -> item.toLowerCase().contains("quiet")));
        assertTrue(response.recommendations().stream().anyMatch(item -> item.toLowerCase().contains("budget")));
        assertEquals("high", response.confidence());
    }
}
