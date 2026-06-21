package com.trackngo.chat.internal.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.trackngo.chat.api.MessageService;
import com.trackngo.chat.api.dto.MessageDto;
import com.trackngo.chat.api.dto.PresenceDto;
import com.trackngo.chat.api.dto.TypingIndicatorDto;
import com.trackngo.chat.internal.service.ChatPresenceService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * WebSocket handler for real-time chat communication.
 * <p>
 * Registered at {@code /ws/chat} by the app module's WebSocketConfig.
 * Uses a JSON-based protocol for message exchange.
 * <p>
 * <strong>Client → Server messages:</strong>
 * <pre>
 * {"action": "SUBSCRIBE",   "conversationId": 123}
 * {"action": "UNSUBSCRIBE", "conversationId": 123}
 * {"action": "SEND_MESSAGE","data": {"conversationId":1, "senderId":4, "content":"Hi", "messageType":"TEXT", ...}}
 * {"action": "TYPING",      "data": {"conversationId":1, "userId":4, "typing":true}}
 * </pre>
 * <p>
 * <strong>Server → Client messages:</strong>
 * <pre>
 * {"event": "NEW_MESSAGE",     "data": { ... MessageDto ... }}
 * {"event": "TYPING",          "data": { ... TypingIndicatorDto ... }}
 * {"event": "STATUS_UPDATE",   "data": [ ... MessageStatusUpdateDto[] ... ]}
 * {"event": "MESSAGE_DELETED", "data": { ... MessageDeleteEventDto ... }}
 * {"event": "ERROR",           "data": {"message": "Error description"}}
 * </pre>
 */
@Component
@Slf4j
public class ChatWebSocketHandler extends TextWebSocketHandler {

    private final MessageService messageService;
    private final ObjectMapper objectMapper;
    private final SimpMessagingTemplate stompTemplate;
    private final ChatPresenceService chatPresenceService;

    /** Active WebSocket sessions indexed by session ID. */
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    /** Conversation ID → set of session IDs subscribed to that conversation. */
    private final Map<Long, Set<String>> conversationSubs = new ConcurrentHashMap<>();

    /** Session ID → set of conversation IDs the session is subscribed to. */
    private final Map<String, Set<Long>> sessionConversations = new ConcurrentHashMap<>();

    public ChatWebSocketHandler(MessageService messageService, ObjectMapper objectMapper,
                                SimpMessagingTemplate stompTemplate,
                                ChatPresenceService chatPresenceService) {
        this.messageService = messageService;
        this.objectMapper = objectMapper;
        this.stompTemplate = stompTemplate;
        this.chatPresenceService = chatPresenceService;
    }

    /**
     * Registers a new WebSocket session.
     */
    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.put(session.getId(), session);
        sessionConversations.put(session.getId(), ConcurrentHashMap.newKeySet());
        log.info("WebSocket connected: sessionId={}", session.getId());
    }

    /**
     * Handles incoming text messages by dispatching based on the "action" field.
     */
    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        try {
            JsonNode root = objectMapper.readTree(message.getPayload());
            String action = root.path("action").asText("");

            switch (action) {
                case "SUBSCRIBE" -> handleSubscribe(session, root);
                case "UNSUBSCRIBE" -> handleUnsubscribe(session, root);
                case "SEND_MESSAGE" -> handleSendMessage(session, root);
                case "TYPING" -> handleTyping(session, root);
                case "PRESENCE" -> handlePresence(session, root);
                default -> sendError(session, "Unknown action: " + action);
            }
        } catch (Exception e) {
            log.error("Error processing WebSocket message: sessionId={}", session.getId(), e);
            sendError(session, "Failed to process message");
        }
    }

    /**
     * Cleans up subscriptions when a WebSocket session closes.
     */
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String sessionId = session.getId();
        sessions.remove(sessionId);

        Set<Long> conversations = sessionConversations.remove(sessionId);
        if (conversations != null) {
            for (Long convId : conversations) {
                Set<String> subs = conversationSubs.get(convId);
                if (subs != null) {
                    subs.remove(sessionId);
                    if (subs.isEmpty()) {
                        conversationSubs.remove(convId);
                    }
                }
            }
        }
        PresenceDto presence = chatPresenceService.markOffline(sessionId);
        if (presence != null) {
            broadcastPresence(presence);
        }
        log.info("WebSocket disconnected: sessionId={}", sessionId);
    }

    /**
     * Broadcasts an event to all WebSocket sessions subscribed to a conversation.
     * Called by REST controllers after mutating operations (e.g., mark read, delete).
     *
     * @param conversationId the target conversation
     * @param event          the event type name (e.g. "STATUS_UPDATE", "MESSAGE_DELETED")
     * @param data           the payload to serialize as JSON
     */
    public void broadcastToConversation(Long conversationId, String event, Object data) {
        // Broadcast to raw WebSocket subscribers
        Set<String> subscriberIds = conversationSubs.get(conversationId);
        if (subscriberIds != null && !subscriberIds.isEmpty()) {
            String json = buildEventJson(event, data);
            if (json != null) {
                TextMessage textMessage = new TextMessage(json);
                for (String sessionId : subscriberIds) {
                    WebSocketSession ws = sessions.get(sessionId);
                    if (ws != null && ws.isOpen()) {
                        try {
                            ws.sendMessage(textMessage);
                        } catch (IOException e) {
                            log.warn("Failed to send to session {}: {}", sessionId, e.getMessage());
                        }
                    }
                }
            }
        }

        // Broadcast to STOMP subscribers
        String stompDest = "/topic/conversations/" + conversationId;
        switch (event) {
            case "NEW_MESSAGE" -> stompTemplate.convertAndSend(stompDest, data);
            case "TYPING" -> stompTemplate.convertAndSend(stompDest + "/typing", data);
            case "STATUS_UPDATE" -> stompTemplate.convertAndSend(stompDest + "/status", data);
            case "MESSAGE_DELETED" -> stompTemplate.convertAndSend(stompDest + "/deleted", data);
            default -> stompTemplate.convertAndSend(stompDest, data);
        }
    }

    /**
     * Broadcasts an event to every raw WebSocket session currently registered
     * for a user. Admin web uses this for shared support inbox updates before
     * it knows a brand-new conversation ID.
     */
    public void broadcastToUser(Long userId, String event, Object data) {
        Set<String> sessionIds = chatPresenceService.getSessionIdsForUser(userId);
        if (sessionIds.isEmpty()) {
            return;
        }

        String json = buildEventJson(event, data);
        if (json == null) {
            return;
        }

        TextMessage textMessage = new TextMessage(json);
        for (String sessionId : sessionIds) {
            WebSocketSession ws = sessions.get(sessionId);
            if (ws != null && ws.isOpen()) {
                try {
                    ws.sendMessage(textMessage);
                } catch (IOException e) {
                    log.warn("Failed to send user event to session {}: {}", sessionId, e.getMessage());
                }
            }
        }
    }

    // ── Private dispatch methods ────────────────────────────────────────

    /**
     * Broadcasts a presence update to every chat socket client.
     *
     * @param presence the current presence state
     */
    public void broadcastPresence(PresenceDto presence) {
        String json = buildEventJson("PRESENCE", presence);
        if (json != null) {
            TextMessage textMessage = new TextMessage(json);
            for (WebSocketSession ws : sessions.values()) {
                if (ws != null && ws.isOpen()) {
                    try {
                        ws.sendMessage(textMessage);
                    } catch (IOException e) {
                        log.warn("Failed to send presence to session {}: {}", ws.getId(), e.getMessage());
                    }
                }
            }
        }
        stompTemplate.convertAndSend("/topic/presence", presence);
    }

    /**
     * Subscribes the session to receive events for a conversation.
     */
    private void handleSubscribe(WebSocketSession session, JsonNode root) {
        Long conversationId = root.path("conversationId").asLong(0);
        if (conversationId <= 0) {
            sendError(session, "Invalid conversationId for SUBSCRIBE");
            return;
        }

        conversationSubs
                .computeIfAbsent(conversationId, k -> ConcurrentHashMap.newKeySet())
                .add(session.getId());
        sessionConversations
                .computeIfAbsent(session.getId(), k -> ConcurrentHashMap.newKeySet())
                .add(conversationId);

        log.debug("Session {} subscribed to conversation {}", session.getId(), conversationId);
    }

    /**
     * Unsubscribes the session from a conversation's events.
     */
    private void handleUnsubscribe(WebSocketSession session, JsonNode root) {
        Long conversationId = root.path("conversationId").asLong(0);
        if (conversationId <= 0) {
            return;
        }

        Set<String> subs = conversationSubs.get(conversationId);
        if (subs != null) {
            subs.remove(session.getId());
            if (subs.isEmpty()) {
                conversationSubs.remove(conversationId);
            }
        }

        Set<Long> convs = sessionConversations.get(session.getId());
        if (convs != null) {
            convs.remove(conversationId);
        }
    }

    /**
     * Processes an incoming chat message: persists it and broadcasts to subscribers.
     */
    private void handleSendMessage(WebSocketSession session, JsonNode root) {
        try {
            JsonNode data = root.path("data");
            MessageDto dto = objectMapper.treeToValue(data, MessageDto.class);
            MessageDto saved = messageService.sendMessage(dto);

            broadcastToConversation(saved.getConversationId(), "NEW_MESSAGE", saved);
        } catch (Exception e) {
            log.error("Error sending message via WebSocket", e);
            sendError(session, "Failed to send message: " + e.getMessage());
        }
    }

    /**
     * Forwards a typing indicator to all subscribers of the conversation.
     */
    private void handleTyping(WebSocketSession session, JsonNode root) {
        try {
            JsonNode data = root.path("data");
            TypingIndicatorDto indicator = objectMapper.treeToValue(data, TypingIndicatorDto.class);
            if (indicator.getConversationId() == null) {
                return;
            }

            broadcastToConversation(indicator.getConversationId(), "TYPING", indicator);
        } catch (Exception e) {
            log.warn("Error processing typing indicator", e);
        }
    }

    // ── Utility methods ─────────────────────────────────────────────────

    /**
     * Registers or clears the current raw WebSocket session from chat presence.
     */
    private void handlePresence(WebSocketSession session, JsonNode root) {
        JsonNode data = root.path("data");
        Long userId = data.path("userId").asLong(root.path("userId").asLong(0));
        boolean online = data.path("online").asBoolean(root.path("online").asBoolean(true));
        PresenceDto presence = online
                ? chatPresenceService.markOnline(session.getId(), userId)
                : chatPresenceService.markOffline(session.getId());

        if (presence != null) {
            broadcastPresence(presence);
        }
    }

    /**
     * Builds a JSON string with the standard envelope: {"event": "...", "data": ...}.
     */
    private String buildEventJson(String event, Object data) {
        try {
            return objectMapper.writeValueAsString(Map.of("event", event, "data", data));
        } catch (Exception e) {
            log.error("Failed to serialize event: {}", event, e);
            return null;
        }
    }

    /**
     * Sends an error message to a specific WebSocket session.
     */
    private void sendError(WebSocketSession session, String errorMessage) {
        try {
            String json = objectMapper.writeValueAsString(
                    Map.of("event", "ERROR", "data", Map.of("message", errorMessage)));
            session.sendMessage(new TextMessage(json));
        } catch (IOException e) {
            log.warn("Failed to send error to session {}: {}", session.getId(), e.getMessage());
        }
    }
}
