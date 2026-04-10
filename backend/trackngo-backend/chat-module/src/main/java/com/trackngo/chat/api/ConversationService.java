
package com.trackngo.chat.api;

import com.trackngo.chat.api.dto.ConversationDto;
import com.trackngo.chat.api.dto.PagedResponseDto;

/**
 * Public API for conversation operations.
 * Other modules may depend on this interface for inter-module communication.
 */
public interface ConversationService {

    /**
     * Retrieves or creates a one-to-one conversation between two users.
     * If user types are null, they are resolved from the user table automatically.
     *
     * @param user1Id   first participant's user ID
     * @param user1Type first participant's type (e.g. PASSENGER, DRIVER) or null
     * @param user2Id   second participant's user ID
     * @param user2Type second participant's type or null
     * @return the existing or newly created conversation
     */
    ConversationDto getOrCreateConversation(Long user1Id, String user1Type,
                                            Long user2Id, String user2Type);

    /**
     * Retrieves paginated conversations for a given user,
     * optionally filtered by a search query on the last message.
     *
     * @param userId the user's ID
     * @param page   zero-based page index
     * @param size   page size
     * @param query  optional search keyword (may be null)
     * @return a paged list of conversation summaries
     */
    PagedResponseDto<ConversationDto> getUserConversations(Long userId, int page,
                                                           int size, String query);
}

