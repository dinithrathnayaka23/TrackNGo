
package com.trackngo.chat.internal.repository;

import com.trackngo.chat.internal.entity.Conversation;
import com.trackngo.chat.internal.entity.enums.ParticipantType;
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
     * matching against the latest message and participant profile names.
     */
    @Query(value = """
            SELECT
                c.conversation_id,
                c.participant_1_id,
                c.participant_1_type,
                c.participant_2_id,
                c.participant_2_type,
                c.participant_1_unread,
                c.participant_2_unread,
                c.last_message,
                c.last_message_type,
                c.last_message_timestamp,
                c.created_at,
                c.updated_at
            FROM conversation c
            LEFT JOIN `user` u1 ON u1.user_id = c.participant_1_id
            LEFT JOIN `user` u2 ON u2.user_id = c.participant_2_id
            LEFT JOIN corporate_user cu1 ON cu1.corporate_user_id = c.participant_1_id
            LEFT JOIN corporate_user cu2 ON cu2.corporate_user_id = c.participant_2_id
            WHERE (c.participant_1_id = :userId OR c.participant_2_id = :userId)
              AND c.participant_1_id <> c.participant_2_id
              AND (
                  LOWER(COALESCE(c.last_message, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                  OR LOWER(TRIM(CONCAT(COALESCE(u1.first_name, ''), ' ', COALESCE(u1.last_name, '')))) LIKE LOWER(CONCAT('%', :q, '%'))
                  OR LOWER(TRIM(CONCAT(COALESCE(u2.first_name, ''), ' ', COALESCE(u2.last_name, '')))) LIKE LOWER(CONCAT('%', :q, '%'))
                  OR LOWER(COALESCE(u1.first_name, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                  OR LOWER(COALESCE(u1.last_name, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                  OR LOWER(COALESCE(u2.first_name, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                  OR LOWER(COALESCE(u2.last_name, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                  OR LOWER(COALESCE(u1.email, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                  OR LOWER(COALESCE(u2.email, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                  OR LOWER(COALESCE(u1.user_type, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                  OR LOWER(COALESCE(u2.user_type, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                  OR LOWER(COALESCE(cu1.company_name, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                  OR LOWER(COALESCE(cu2.company_name, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                  OR LOWER(COALESCE(cu1.contact_person_name, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                  OR LOWER(COALESCE(cu2.contact_person_name, '')) LIKE LOWER(CONCAT('%', :q, '%'))
              )
            ORDER BY c.updated_at DESC
            """,
            countQuery = """
            SELECT COUNT(*)
            FROM conversation c
            LEFT JOIN `user` u1 ON u1.user_id = c.participant_1_id
            LEFT JOIN `user` u2 ON u2.user_id = c.participant_2_id
            LEFT JOIN corporate_user cu1 ON cu1.corporate_user_id = c.participant_1_id
            LEFT JOIN corporate_user cu2 ON cu2.corporate_user_id = c.participant_2_id
            WHERE (c.participant_1_id = :userId OR c.participant_2_id = :userId)
              AND c.participant_1_id <> c.participant_2_id
              AND (
                  LOWER(COALESCE(c.last_message, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                  OR LOWER(TRIM(CONCAT(COALESCE(u1.first_name, ''), ' ', COALESCE(u1.last_name, '')))) LIKE LOWER(CONCAT('%', :q, '%'))
                  OR LOWER(TRIM(CONCAT(COALESCE(u2.first_name, ''), ' ', COALESCE(u2.last_name, '')))) LIKE LOWER(CONCAT('%', :q, '%'))
                  OR LOWER(COALESCE(u1.first_name, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                  OR LOWER(COALESCE(u1.last_name, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                  OR LOWER(COALESCE(u2.first_name, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                  OR LOWER(COALESCE(u2.last_name, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                  OR LOWER(COALESCE(u1.email, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                  OR LOWER(COALESCE(u2.email, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                  OR LOWER(COALESCE(u1.user_type, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                  OR LOWER(COALESCE(u2.user_type, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                  OR LOWER(COALESCE(cu1.company_name, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                  OR LOWER(COALESCE(cu2.company_name, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                  OR LOWER(COALESCE(cu1.contact_person_name, '')) LIKE LOWER(CONCAT('%', :q, '%'))
                  OR LOWER(COALESCE(cu2.contact_person_name, '')) LIKE LOWER(CONCAT('%', :q, '%'))
              )
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

    /**
     * Resolves the display name and avatar for a participant in one pass.
     *
     * <p>The photo is stored on the role table that backs the user rather than
     * on `user` itself, so all four are joined and coalesced the same way the
     * user profile endpoint does it. A user only ever has one role row, so at
     * most one branch of the COALESCE is non-null.
     */
    @Query(value = """
            SELECT
                COALESCE(
                    NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''),
                    NULLIF(cu.company_name, ''),
                    NULLIF(cu.contact_person_name, ''),
                    NULLIF(u.email, ''),
                    CONCAT('User #', :userId)
                ) AS displayName,
                COALESCE(p.profile_photo, d.profile_photo, cu.profile_photo, a.profile_photo) AS profilePhoto
            FROM `user` u
            LEFT JOIN passenger p ON p.passenger_id = u.user_id
            LEFT JOIN driver d ON d.driver_id = u.user_id
            LEFT JOIN corporate_user cu ON cu.corporate_user_id = u.user_id
            LEFT JOIN admin a ON a.admin_id = u.user_id
            WHERE u.user_id = :userId
            """, nativeQuery = true)
    Optional<ParticipantSummaryProjection> findParticipantSummaryByUserId(@Param("userId") Long userId);

    /**
     * Retrieves conversations attached to the shared admin-support user.
     */
    @Query("""
            SELECT c FROM Conversation c
            WHERE ((c.participant1Id = :supportAdminId AND c.participant1Type = :supportType)
                OR (c.participant2Id = :supportAdminId AND c.participant2Type = :supportType))
            ORDER BY c.updatedAt DESC
            """)
    Page<Conversation> findSupportConversations(
            @Param("supportAdminId") Long supportAdminId,
            @Param("supportType") ParticipantType supportType,
            Pageable pageable);

    /**
     * Retrieves support conversations filtered by latest message text.
     */
    @Query("""
            SELECT c FROM Conversation c
            WHERE ((c.participant1Id = :supportAdminId AND c.participant1Type = :supportType)
                OR (c.participant2Id = :supportAdminId AND c.participant2Type = :supportType))
              AND LOWER(COALESCE(c.lastMessage, '')) LIKE LOWER(CONCAT('%', :q, '%'))
            ORDER BY c.updatedAt DESC
            """)
    Page<Conversation> findSupportConversationsWithSearch(
            @Param("supportAdminId") Long supportAdminId,
            @Param("supportType") ParticipantType supportType,
            @Param("q") String q,
            Pageable pageable);
}

