package com.trackngo.chat.internal.controller;

import com.trackngo.chat.api.MessageService;
import com.trackngo.chat.api.dto.MessageDto;
import com.trackngo.chat.api.dto.TypingIndicatorDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

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
        messagingTemplate.convertAndSend(
                "/topic/conversations/" + dto.getConversationId() + "/typing", dto);
    }
}
