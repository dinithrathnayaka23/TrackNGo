package com.trackngo.chat.internal.controller;

import com.trackngo.chat.api.MessageService;
import com.trackngo.chat.api.dto.MessageDto;
import com.trackngo.chat.api.dto.PresenceDto;
import com.trackngo.chat.api.dto.TypingIndicatorDto;
import com.trackngo.chat.internal.service.ChatPresenceService;
import com.trackngo.chat.internal.websocket.ChatWebSocketHandler;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

/**
 * STOMP message controller that receives messages from the front-end
 * via {@code /app/sendMessage} and {@code /app/typing}, persists when
 * needed, and broadcasts to the appropriate topic destinations.
 */
@Controller
@RequiredArgsConstructor
@Slf4j
public class ChatStompController {

    private final MessageService messageService;
    private final SimpMessagingTemplate messagingTemplate;
    private final ChatPresenceService chatPresenceService;
    private final ChatWebSocketHandler chatWebSocketHandler;

    @MessageMapping("/sendMessage")
    public void handleSendMessage(MessageDto dto) {
        try {
            log.info("STOMP sendMessage received: conversationId={}, senderId={}, content={}",
                    dto.getConversationId(), dto.getSenderId(),
                    dto.getContent() != null ? dto.getContent().substring(0, Math.min(50, dto.getContent().length())) : "null");
            MessageDto saved = messageService.sendMessage(dto);
            log.info("Message saved: messageId={}", saved.getMessageId());
            messagingTemplate.convertAndSend(
                    "/topic/conversations/" + saved.getConversationId(), saved);
        } catch (Exception e) {
            log.error("Error handling STOMP sendMessage: {}", e.getMessage(), e);
        }
    }

    @MessageMapping("/typing")
    public void handleTyping(TypingIndicatorDto dto) {
        if (dto.getConversationId() == null) {
            return;
        }
        chatWebSocketHandler.broadcastToConversation(
                dto.getConversationId(), "TYPING", dto);
    }

    @MessageMapping("/presence")
    public void handlePresence(PresenceDto dto, SimpMessageHeaderAccessor headers) {
        String sessionId = headers.getSessionId();
        if (sessionId == null || dto.getUserId() == null) {
            return;
        }

        PresenceDto presence = dto.isOnline()
                ? chatPresenceService.markOnline(sessionId, dto.getUserId())
                : chatPresenceService.markOffline(sessionId);

        if (presence != null) {
            chatWebSocketHandler.broadcastPresence(presence);
        }
    }

    @EventListener
    public void handleSessionDisconnect(SessionDisconnectEvent event) {
        PresenceDto presence = chatPresenceService.markOffline(event.getSessionId());
        if (presence != null) {
            chatWebSocketHandler.broadcastPresence(presence);
        }
    }
}
