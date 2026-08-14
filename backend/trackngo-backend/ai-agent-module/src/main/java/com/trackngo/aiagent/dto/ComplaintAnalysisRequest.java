package com.trackngo.aiagent.dto;

import java.util.Locale;

public record ComplaintAnalysisRequest(String complaintText, String userId, String channel) {

    public ComplaintAnalysisRequest {
        complaintText = complaintText == null ? "" : complaintText.trim();
        userId = userId == null ? "anonymous" : userId.trim();
        channel = channel == null ? "web" : channel.trim().toLowerCase(Locale.ROOT);

        if (complaintText.isBlank()) {
            throw new IllegalArgumentException("Complaint text is required.");
        }
    }
}
