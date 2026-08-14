package com.trackngo.aiagent.agents;

import com.trackngo.aiagent.dto.ComplaintAnalysisRequest;
import com.trackngo.aiagent.dto.ComplaintAnalysisResponse;
import com.trackngo.aiagent.services.ComplaintAgentService;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ComplaintAgentTest {

    private final ComplaintAgentService complaintAgentService = new ComplaintAgentService();

    @Test
    void shouldCategorizeAndRouteUrgentSafetyComplaints() {
        ComplaintAnalysisRequest request = new ComplaintAnalysisRequest(
                "There was a safety incident and an emergency happened on the bus.",
                "user-001",
                "mobile"
        );

        ComplaintAnalysisResponse response = complaintAgentService.analyzeComplaint(request);

        assertNotNull(response);
        assertEquals("SAFETY_INCIDENT", response.category());
        assertEquals("URGENT", response.priority());
        assertEquals("OPS_ESCALATION", response.routingTarget());
        assertTrue(response.summary().contains("safety incident"));
    }
}
