package com.trackngo.aiagent.dto;

import java.util.List;

public record RecommendationResponse(
        List<String> recommendations,
        String reasoning,
        String confidence
) {
}
