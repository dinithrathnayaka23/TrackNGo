
package com.trackngo.chat.internal.repository;

import com.trackngo.chat.internal.entity.ChatMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Spring Data repository for {@link ChatMessage} entities.
 */
public interface MessageRepository extends JpaRepository<ChatMessage, Long> {

    /**
     * Retrieves messages for a conversation ordered newest-first.
     */
    Page<ChatMessage> findByConversation_ConversationIdOrderByCreatedAtDesc(
            Long conversationId, Pageable pageable);

    /**
     * Retrieves messages created before a given timestamp (cursor-based pagination).
     */
    Page<ChatMessage> findByConversation_ConversationIdAndCreatedAtBeforeOrderByCreatedAtDesc(
            Long conversationId, LocalDateTime before, Pageable pageable);

    /**
     * Finds unread messages in a conversation that were NOT sent by the given user.
     */
    @Query("""
            SELECT m FROM ChatMessage m
            WHERE m.conversation.conversationId = :conversationId
              AND m.senderId <> :userId
              AND m.read = false
            ORDER BY m.createdAt ASC
            """)
    List<ChatMessage> findUnreadByConversationAndRecipient(
            @Param("conversationId") Long conversationId,
            @Param("userId") Long userId);

    /**
     * Finds the latest non-deleted message in a conversation (for preview updates).
     */
    Optional<ChatMessage> findTopByConversation_ConversationIdAndDeletedFalseOrderByCreatedAtDesc(
            Long conversationId);
}

