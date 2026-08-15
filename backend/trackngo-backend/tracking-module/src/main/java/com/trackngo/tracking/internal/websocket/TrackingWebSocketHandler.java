
package com.trackngo.tracking.internal.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.trackngo.tracking.api.dto.LiveBusLocationDto;
import com.trackngo.tracking.internal.service.LiveLocationQualityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j//used for logging to create a logger object
@Component
@RequiredArgsConstructor
public class TrackingWebSocketHandler extends TextWebSocketHandler {
    private final Set<WebSocketSession> sessions = ConcurrentHashMap.newKeySet();

    private final LiveLocationQualityService liveLocationQualityService;
    private final ObjectMapper objectMapper;

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.add(session);
        log.info("Tracking WebSocket connected: {}", session.getId());
    }

    /*
      Handle a location published over the socket rather than over REST.

      This must not simply echo what it receives. Every connected passenger is
      on this socket, so a blind re-broadcast would let any client put any
      coordinates on every rider's map, bypassing the quality rules that the
      REST path applies. Instead the payload goes through the same gatekeeper,
      and only a fix that survives is forwarded.
    */
    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        LiveBusLocationDto incoming;
        try {
            incoming = objectMapper.readValue(message.getPayload(), LiveBusLocationDto.class);
        } catch (Exception e) {
            log.debug("Discarding unreadable tracking message from {}: {}", session.getId(), e.getMessage());
            return;
        }

        LiveLocationQualityService.Result result =
                liveLocationQualityService.submit(incoming, System.currentTimeMillis());

        if (!result.isAccepted()) {
            log.debug("Discarding tracking message from {}: {}", session.getId(), result.getReason());
            return;
        }

        try {
            broadcast(new TextMessage(objectMapper.writeValueAsString(result.getLocation())));
        } catch (Exception e) {
            log.error("Failed to broadcast bus location for {}", result.getLocation().getBusNumber(), e);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, org.springframework.web.socket.CloseStatus status) {
        sessions.remove(session);
        log.info("Tracking WebSocket disconnected: {}", session.getId());
    }

    /**
     * Broadcast a message to all connected WebSocket sessions.
     */
    public void broadcast(TextMessage message) {
        for (WebSocketSession s : sessions) {
            if (s.isOpen()) {
                try {
                    s.sendMessage(message);
                } catch (Exception e) {
                    log.warn("Failed to send to session {}: {}", s.getId(), e.getMessage());
                }
            }
        }
    }
}
