package com.trackngo.aiagent.agents;

import com.trackngo.aiagent.services.NotificationAgentService;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class NotificationAgentTest {

    @Test
    void shouldCreateContextualNotificationsForTrips() {
        NotificationAgent notificationAgent = new NotificationAgent(new NotificationAgentService());

        NotificationAgent.NotificationRequest reminderRequest =
                new NotificationAgent.NotificationRequest("reminder", "BUS-101", "Your bus is departing soon", "Colombo", "Kandy");
        NotificationAgent.NotificationRequest delayRequest =
                new NotificationAgent.NotificationRequest("delay_alert", "BUS-101", "Traffic congestion ahead", "Colombo", "Kandy");
        NotificationAgent.NotificationRequest routeRequest =
                new NotificationAgent.NotificationRequest("alternative_route", "BUS-101", "Road closure detected", "Colombo", "Kandy");

        var reminderFunction = notificationAgent.sendNotification();
        NotificationAgent.NotificationResponse reminderResponse = reminderFunction.apply(reminderRequest);
        NotificationAgent.NotificationResponse delayResponse = reminderFunction.apply(delayRequest);
        NotificationAgent.NotificationResponse routeResponse = reminderFunction.apply(routeRequest);

        assertNotNull(reminderResponse);
        assertEquals("reminder", reminderResponse.type());
        assertFalse(reminderResponse.message().isBlank());

        assertNotNull(delayResponse);
        assertEquals("delay_alert", delayResponse.type());
        String normalizedDelayMessage = delayResponse.message().toLowerCase();
        assertTrue(normalizedDelayMessage.contains("delay") || normalizedDelayMessage.contains("traffic"));

        assertNotNull(routeResponse);
        assertEquals("alternative_route", routeResponse.type());
        assertFalse(routeResponse.suggestedRoute().isBlank());
    }
}
