
package com.trackngo.chat.internal.repository;

import com.trackngo.chat.internal.entity.Conversation;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

/**
 * Spring Data repository for {@link Conversation} entities.
 */
public interface ConversationRepository extends JpaRepository<Conversation, Long> {

    /**
     * Finds the unique conversation between two users regardless of participant order.
     */
    @Query(value = """
            SELECT * FROM conversation
            WHERE (participant_1_id = :user1 AND participant_2_id = :user2)
               OR (participant_1_id = :user2 AND participant_2_id = :user1)
            LIMIT 1
            """, nativeQuery = true)
    Optional<Conversation> findBetweenUsers(@Param("user1") Long user1,
                                            @Param("user2") Long user2);

    /**
     * Retrieves paginated conversations for a user (no search filter).
     */
    @Query(value = """
            SELECT * FROM conversation
            WHERE (participant_1_id = :userId OR participant_2_id = :userId)
              AND participant_1_id <> participant_2_id
            ORDER BY updated_at DESC
            """,
            countQuery = """
            SELECT COUNT(*) FROM conversation
            WHERE (participant_1_id = :userId OR participant_2_id = :userId)
              AND participant_1_id <> participant_2_id
            """,
            nativeQuery = true)
    Page<Conversation> findUserConversations(@Param("userId") Long userId,
                                             Pageable pageable);

    /**
     * Retrieves paginated conversations for a user filtered by search keyword
     * matching against the last message text.
     */
    @Query(value = """
            SELECT * FROM conversation
            WHERE (participant_1_id = :userId OR participant_2_id = :userId)
                                                        AND participant_1_id <> participant_2_id
              AND LOWER(COALESCE(last_message, '')) LIKE LOWER(CONCAT('%', :q, '%'))
            ORDER BY updated_at DESC
            """,
            countQuery = """
            SELECT COUNT(*) FROM conversation
            WHERE (participant_1_id = :userId OR participant_2_id = :userId)
                                                        AND participant_1_id <> participant_2_id
              AND LOWER(COALESCE(last_message, '')) LIKE LOWER(CONCAT('%', :q, '%'))
            """,
            nativeQuery = true)
    Page<Conversation> findUserConversationsWithSearch(@Param("userId") Long userId,
                                                       @Param("q") String q,
                                                       Pageable pageable);

    /**
     * Looks up a user's type from the shared user table via native query.
     * Used when creating conversations without explicit participant types.
     */
    @Query(value = "SELECT user_type FROM user WHERE user_id = :userId", nativeQuery = true)
    Optional<String> findUserTypeByUserId(@Param("userId") Long userId);
}

