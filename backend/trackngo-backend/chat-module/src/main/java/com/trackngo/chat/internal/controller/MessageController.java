
package com.trackngo.chat.internal.controller;

import com.trackngo.chat.api.MessageService;
import com.trackngo.chat.api.dto.MessageDeleteEventDto;
import com.trackngo.chat.api.dto.MessageDto;
import com.trackngo.chat.api.dto.MessageStatusUpdateDto;
import com.trackngo.chat.api.dto.PagedResponseDto;
import com.trackngo.chat.internal.websocket.ChatWebSocketHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

/**
 * REST controller for chat message endpoints.
 * Handles message retrieval, read receipts, and deletion.
 * After mutating operations, broadcasts updates to connected WebSocket clients.
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class MessageController {

    private static final Long SUPPORT_ADMIN_ID = 1L;

    private final MessageService messageService;
    private final ChatWebSocketHandler chatWebSocketHandler;

    /**
     * Retrieves paginated messages for a conversation, ordered newest-first.
     *
     * @param conversationId the conversation to query
     * @param page           zero-based page index (default 0)
     * @param size           items per page (default 30)
     * @param before         optional upper-bound timestamp for cursor pagination
     * @return paginated list of messages
     */
    @GetMapping("/conversations/{conversationId}/messages")
    public PagedResponseDto<MessageDto> getMessages(
                        @PathVariable("conversationId") Long conversationId,
                        @RequestParam(name = "page", defaultValue = "0") int page,
                        @RequestParam(name = "size", defaultValue = "30") int size,
                        @RequestParam(name = "before", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime before) {
        return messageService.getConversationMessages(conversationId, page, size, before);
    }

    /**
     * Persists a new message for a conversation and broadcasts it to subscribers.
     * This provides a reliable HTTP send path while STOMP remains responsible for
     * live fan-out to other connected clients.
     *
     * @param conversationId the conversation receiving the message
     * @param dto            the inbound message payload
     * @return the saved message DTO
     */
    @PostMapping("/conversations/{conversationId}/messages")
    public MessageDto sendMessage(
            @PathVariable("conversationId") Long conversationId,
            @RequestBody MessageDto dto) {
        dto.setConversationId(conversationId);
        MessageDto saved = messageService.sendMessage(dto);
        chatWebSocketHandler.broadcastToConversation(
                saved.getConversationId(), "NEW_MESSAGE", saved);
        if (SUPPORT_ADMIN_ID.equals(saved.getRecipientId())
                || SUPPORT_ADMIN_ID.equals(saved.getSenderId())) {
            chatWebSocketHandler.broadcastToUser(
                    SUPPORT_ADMIN_ID, "SUPPORT_INBOX_UPDATED", saved);
        }
        return saved;
    }

    /**
     * Acknowledges delivery of messages in a conversation for the given user.
     * Broadcasts status updates to WebSocket subscribers.
     *
     * @param conversationId the conversation ID
     * @param userId         the user acknowledging delivery
     * @return list of status updates (empty for current schema)
     */
    @PostMapping("/conversations/{conversationId}/delivered")
    public List<MessageStatusUpdateDto> markDelivered(
            @PathVariable("conversationId") Long conversationId,
            @RequestParam("userId") Long userId) {
        List<MessageStatusUpdateDto> updates =
                messageService.markConversationDelivered(conversationId, userId);
        if (!updates.isEmpty()) {
            chatWebSocketHandler.broadcastToConversation(
                    conversationId, "STATUS_UPDATE", updates);
        }
        return updates;
    }

    /**
     * Marks all unread messages in a conversation as read for the given user.
     * Resets the user's unread counter and broadcasts status updates via WebSocket.
     *
     * @param conversationId the conversation ID
     * @param userId         the user marking messages as read
     * @return list of status updates for each affected message
     */
    @PostMapping("/conversations/{conversationId}/read")
    public List<MessageStatusUpdateDto> markRead(
            @PathVariable("conversationId") Long conversationId,
            @RequestParam("userId") Long userId) {
        List<MessageStatusUpdateDto> updates =
                messageService.markConversationRead(conversationId, userId);
        if (!updates.isEmpty()) {
            chatWebSocketHandler.broadcastToConversation(
                    conversationId, "STATUS_UPDATE", updates);
        }
        return updates;
    }

    /**
     * Soft-deletes a message. Only the original sender may delete their message.
     * Broadcasts the deletion event to WebSocket subscribers.
     *
     * @param messageId the message to delete
     * @param userId    the user requesting deletion (must be the sender)
     * @return event details about the deletion
     */
    @DeleteMapping("/messages/{messageId}")
    public MessageDeleteEventDto deleteMessage(
            @PathVariable("messageId") Long messageId,
            @RequestParam("userId") Long userId) {
        MessageDeleteEventDto event = messageService.deleteMessage(messageId, userId);
        chatWebSocketHandler.broadcastToConversation(
                event.getConversationId(), "MESSAGE_DELETED", event);
        return event;
    }
}

