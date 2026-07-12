package com.trackngo.aiagent.dto;

public record ComplaintAnalysisResponse(
        String summary,
        String category,
        String priority,
        String routingTarget,
        String suggestedAction
) {
}
