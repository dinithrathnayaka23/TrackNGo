package com.trackngo.aiagent.services;

import com.trackngo.aiagent.agents.NotificationAgent;
import com.trackngo.aiagent.context.AgentExecutionContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.time.LocalDateTime;
import java.util.Locale;

@Service
@Slf4j
public class NotificationAgentService {

    private final JdbcTemplate jdbc;

    public NotificationAgentService() {
        this.jdbc = null;
    }

    @Autowired
    public NotificationAgentService(ObjectProvider<JdbcTemplate> jdbc) {
        this.jdbc = jdbc.getIfAvailable();
    }

    public NotificationAgent.NotificationResponse sendNotification(NotificationAgent.NotificationRequest request) {
        log.info("Processing {} notification for bus {} from {} to {}", request.type(), request.busId(), request.source(), request.destination());

        String type = normalizeType(request.type());
        String message;
        String suggestedRoute = "";

        switch (type) {
            case "reminder" -> {
                message = "Reminder: " + busLabel(request) + " is departing soon from " + valueOrDefault(request.source(), "your boarding stop") + ". Please be at the halt 15 minutes early.";
            }
            case "delay_alert" -> {
                // The observation has to be supplied by the caller. This used to state
                // that traffic was affecting the bus and that the passenger should
                // allow extra time, without anything ever having checked: the alert
                // fired because the passenger's own message contained the word
                // "delay". There is no traffic feed behind this service.
                message = "Delay alert: " + valueOrDefault(
                        request.eventMessage(),
                        busLabel(request) + " is reported as delayed.");
                suggestedRoute = "Check alternatives on the same route, or nearby Colombo Fort, Kadawatha, Panadura, Galle, Kandy, or Matara stops where applicable.";
            }
            case "bus_status" -> {
                // What live tracking actually reports, passed through unchanged.
                message = valueOrDefault(
                        request.eventMessage(),
                        "No current status is available for " + busLabel(request) + ".");
            }
            case "alternative_route" -> {
                message = "Alternative route: A disruption has been detected for " + busLabel(request) + ".";
                suggestedRoute = "Look for the next active TrackNGo bus between " + valueOrDefault(request.source(), "your boarding stop") + " and " + valueOrDefault(request.destination(), "your destination") + " before cancelling.";
            }
            case "promotion", "recommendation" -> {
                message = "TrackNGo recommendation: " + valueOrDefault(request.eventMessage(), "Check current routes and promotions before your next journey.");
            }
            default -> {
                message = "TrackNGo update: " + valueOrDefault(request.eventMessage(), "Please check the TrackNGo app for the latest travel information.");
            }
        }

        Long notificationId = persistNotification(type, message, request);
        return new NotificationAgent.NotificationResponse(type, message, suggestedRoute, notificationId);
    }

    private Long persistNotification(String type, String message, NotificationAgent.NotificationRequest request) {
        if (jdbc == null) {
            return null;
        }
        Long passengerId = request.passengerId();
        AgentExecutionContext.Context context = AgentExecutionContext.get();
        if (passengerId == null && context != null && "passenger".equalsIgnoreCase(context.role())) {
            passengerId = context.userId();
        }
        Long driverId = request.driverId();
        Long adminId = request.adminId();
        if (passengerId == null && driverId == null && adminId == null) {
            return null;
        }

        try {
            Long finalPassengerId = passengerId;
            String databaseType = databaseType(type);
            KeyHolder keyHolder = new GeneratedKeyHolder();
            jdbc.update(connection -> {
                PreparedStatement ps = connection.prepareStatement("""
                        INSERT INTO notification
                            (notification_type, title, message, is_read, created_at, passenger_id, driver_id, admin_id)
                        VALUES (?, ?, ?, false, ?, ?, ?, ?)
                        """, Statement.RETURN_GENERATED_KEYS);
                ps.setString(1, databaseType);
                ps.setString(2, titleFor(type));
                ps.setString(3, message);
                ps.setObject(4, LocalDateTime.now());
                ps.setObject(5, finalPassengerId);
                ps.setObject(6, driverId);
                ps.setObject(7, adminId);
                return ps;
            }, keyHolder);
            return keyHolder.getKey() == null ? null : keyHolder.getKey().longValue();
        } catch (Exception ex) {
            log.warn("Unable to persist AI notification: {}", ex.getMessage());
            return null;
        }
    }

    private String normalizeType(String type) {
        if (type == null || type.isBlank()) {
            return "general";
        }
        return type.trim().toLowerCase(Locale.ROOT);
    }

    private String titleFor(String type) {
        return switch (type) {
            case "reminder" -> "Trip reminder";
            case "delay_alert" -> "Delay alert";
            case "bus_status" -> "Bus status";
            case "alternative_route" -> "Alternative route";
            case "promotion", "recommendation" -> "Personalized recommendation";
            default -> "TrackNGo update";
        };
    }

    /** Maps AI-specific notification names to values accepted by the notification table enum. */
    private String databaseType(String type) {
        return switch (type) {
            case "reminder", "delay_alert", "alternative_route", "bus_status" -> "journey";
            case "promotion", "recommendation" -> "promotion";
            default -> "system_alert";
        };
    }

    private String busLabel(NotificationAgent.NotificationRequest request) {
        return request.busId() == null || request.busId().isBlank()
                ? "your TrackNGo bus"
                : "your TrackNGo bus " + request.busId();
    }

    private String valueOrDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private String routeLabel(NotificationAgent.NotificationRequest request) {
        if (request.source() == null || request.destination() == null) {
            return "Sri Lankan";
        }
        return request.source() + " to " + request.destination();
    }
}