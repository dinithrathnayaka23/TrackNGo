package com.trackngo.aiagent.services;

import com.trackngo.aiagent.agents.NotificationAgent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class NotificationAgentService {

    public NotificationAgent.NotificationResponse sendNotification(NotificationAgent.NotificationRequest request) {
        log.info("Processing {} notification for bus {} from {} to {}", request.type(), request.busId(), request.source(), request.destination());

        String message;
        String suggestedRoute = "";

        switch (request.type()) {
            case "reminder" -> {
                message = "Reminder: Your bus " + request.busId() + " is departing soon from " + request.source() + ".";
            }
            case "delay_alert" -> {
                message = "Delay alert: Traffic is affecting bus " + request.busId() + ". Please allow extra time.";
                suggestedRoute = "Stay on the main corridor and expect a 10-minute delay.";
            }
            case "alternative_route" -> {
                message = "Alternative route: A road closure has been detected for bus " + request.busId() + ".";
                suggestedRoute = "Take the northern bypass route via Temple Road.";
            }
            default -> {
                message = "Notification update for bus " + request.busId() + ": " + request.eventMessage();
            }
        }

        return new NotificationAgent.NotificationResponse(request.type(), message, suggestedRoute);
    }
}
