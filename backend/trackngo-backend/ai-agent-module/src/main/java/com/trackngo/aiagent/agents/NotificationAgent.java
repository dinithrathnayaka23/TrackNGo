package com.trackngo.aiagent.agents;

import com.trackngo.aiagent.services.NotificationAgentService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Description;

import java.util.function.Function;

@Configuration
@Slf4j
public class NotificationAgent {

    private final NotificationAgentService notificationAgentService;

    public NotificationAgent(NotificationAgentService notificationAgentService) {
        this.notificationAgentService = notificationAgentService;
    }

    public record NotificationRequest(
            String type,
            String busId,
            String eventMessage,
            String source,
            String destination,
            Long passengerId,
            Long driverId,
            Long adminId) {
        public NotificationRequest(String type, String busId, String eventMessage, String source, String destination) {
            this(type, busId, eventMessage, source, destination, null, null, null);
        }
    }

    public record NotificationResponse(String type, String message, String suggestedRoute, Long notificationId) {
        public NotificationResponse(String type, String message, String suggestedRoute) {
            this(type, message, suggestedRoute, null);
        }
    }

    @Bean
    @Description("Sends ride reminders, delay alerts, and alternative-route suggestions for passengers.")
    public Function<NotificationRequest, NotificationResponse> sendNotification() {
        return notificationAgentService::sendNotification;
    }
}
