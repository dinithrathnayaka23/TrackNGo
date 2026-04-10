
package com.trackngo.chat.api;

import com.trackngo.chat.api.dto.MessageDeleteEventDto;
import com.trackngo.chat.api.dto.MessageDto;
import com.trackngo.chat.api.dto.MessageStatusUpdateDto;
import com.trackngo.chat.api.dto.PagedResponseDto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Public API for chat message operations.
 * Other modules may depend on this interface for inter-module communication.
 */
public interface MessageService {

    /**
     * Persists a new chat message and updates the parent conversation's preview.
     *
     * @param dto the incoming message data
     * @return the saved message with server-assigned fields populated
     */
    MessageDto sendMessage(MessageDto dto);

    /**
     * Retrieves paginated messages for a conversation, ordered newest-first.
     *
     * @param conversationId the conversation to query
     * @param page           zero-based page index
     * @param size           page size
     * @param before         optional upper-bound timestamp for cursor-based pagination
     * @return a paged list of messages
     */
    PagedResponseDto<MessageDto> getConversationMessages(Long conversationId,
                                                          int page, int size,
                                                          LocalDateTime before);

    /**
     * Acknowledges message delivery for the given user in a conversation.
     * Returns an empty list as delivery status is not tracked in the current schema.
     *
     * @param conversationId the conversation ID
     * @param userId         the user acknowledging delivery
     * @return an empty list
     */
    List<MessageStatusUpdateDto> markConversationDelivered(Long conversationId, Long userId);

    /**
     * Marks all unread incoming messages in a conversation as read
     * and resets the user's unread counter.
     *
     * @param conversationId the conversation ID
     * @param userId         the user marking messages as read
     * @return status updates for each affected message
     */
    List<MessageStatusUpdateDto> markConversationRead(Long conversationId, Long userId);

    /**
     * Soft-deletes a message. Only the original sender may delete their own message.
     *
     * @param messageId the message to delete
     * @param userId    the user requesting deletion
     * @return event details about the deletion
     */
    MessageDeleteEventDto deleteMessage(Long messageId, Long userId);
}

