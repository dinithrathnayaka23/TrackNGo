package com.trackngo.aiagent.agents;

import com.trackngo.aiagent.context.AgentExecutionContext;
import com.trackngo.aiagent.dto.RecommendationRequest;
import com.trackngo.aiagent.dto.RecommendationResponse;
import com.trackngo.aiagent.services.NotificationAgentService;
import com.trackngo.aiagent.services.RecommendationAgentService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RecommendationAgentTest {

    private final RecommendationAgentService recommendationAgentService = new RecommendationAgentService();

    @AfterEach
    void clearContext() {
        AgentExecutionContext.clear();
    }

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

    @Test
    void shouldSendPassengerRecommendationsToNotificationInbox() {
        NotificationAgentService notificationService = mock(NotificationAgentService.class);
        when(notificationService.sendNotification(any()))
                .thenReturn(new NotificationAgent.NotificationResponse("promotion", "saved", "", 77L));
        AgentExecutionContext.set(new AgentExecutionContext.Context(4L, "passenger@trackngo.com", "passenger", "recommendation-test"));

        RecommendationAgentService service = new RecommendationAgentService(null, notificationService);
        RecommendationResponse response = service.generateRecommendations(new RecommendationRequest(
                "4", "morning commute", "budget", List.of()));

        assertEquals(77L, response.notificationId());
        ArgumentCaptor<NotificationAgent.NotificationRequest> captor = ArgumentCaptor.forClass(NotificationAgent.NotificationRequest.class);
        verify(notificationService).sendNotification(captor.capture());
        assertEquals("promotion", captor.getValue().type());
        assertEquals(4L, captor.getValue().passengerId());
    }
}