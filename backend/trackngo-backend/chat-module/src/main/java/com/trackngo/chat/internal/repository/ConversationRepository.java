
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
    @Query("""
            SELECT c FROM Conversation c
            WHERE (c.participant1Id = :user1 AND c.participant2Id = :user2)
               OR (c.participant1Id = :user2 AND c.participant2Id = :user1)
            """)
    Optional<Conversation> findBetweenUsers(@Param("user1") Long user1,
                                            @Param("user2") Long user2);

    /**
     * Retrieves paginated conversations for a user (no search filter).
     */
    @Query("""
            SELECT c FROM Conversation c
            WHERE (c.participant1Id = :userId OR c.participant2Id = :userId)
              AND c.participant1Id <> c.participant2Id
            ORDER BY c.updatedAt DESC
            """)
    Page<Conversation> findUserConversations(@Param("userId") Long userId,
                                             Pageable pageable);

    /**
     * Retrieves paginated conversations for a user filtered by search keyword
     * matching against the last message text.
     */
    @Query("""
            SELECT c FROM Conversation c
            WHERE (c.participant1Id = :userId OR c.participant2Id = :userId)
              AND c.participant1Id <> c.participant2Id
              AND LOWER(COALESCE(c.lastMessage, '')) LIKE LOWER(CONCAT('%', :q, '%'))
            ORDER BY c.updatedAt DESC
            """)
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

