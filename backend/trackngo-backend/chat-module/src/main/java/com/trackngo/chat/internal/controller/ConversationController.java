
package com.trackngo.chat.internal.controller;

import com.trackngo.chat.api.ConversationService;
import com.trackngo.chat.api.dto.ConversationDto;
import com.trackngo.chat.api.dto.PagedResponseDto;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * REST controller for chat conversation endpoints.
 * Handles conversation retrieval, search, and creation.
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ConversationController {

    private final ConversationService conversationService;

    /**
     * Retrieves paginated conversations for a user with optional search filtering.
     *
     * @param userId the user whose conversations to fetch
     * @param page   zero-based page index (default 0)
     * @param size   number of items per page (default 20)
     * @param q      optional search keyword applied to last message text
     * @return paginated list of conversation summaries
     */
    @GetMapping("/users/{userId}/conversations")
    public PagedResponseDto<ConversationDto> getConversations(
            @PathVariable("userId") Long userId,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size,
            @RequestParam(name = "q", required = false) String q) {
        return conversationService.getUserConversations(userId, page, size, q);
    }

    /**
     * Searches conversations for a user by keyword.
     * This is an alias for the main conversations endpoint with a required query.
     *
     * @param userId the user whose conversations to search
     * @param q      the search keyword (required)
     * @param page   zero-based page index (default 0)
     * @param size   number of items per page (default 20)
     * @return paginated search results
     */
    @GetMapping("/users/{userId}/conversations/search")
    public PagedResponseDto<ConversationDto> searchConversations(
            @PathVariable("userId") Long userId,
            @RequestParam("q") String q,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size) {
        return conversationService.getUserConversations(userId, page, size, q);
    }

    /**
     * Retrieves the shared customer-support inbox. Every admin sees the same
     * mailbox because passengers chat with the single support participant.
     *
     * @param supportAdminId admin user ID used as the support identity
     * @param page           zero-based page index
     * @param size           number of items per page
     * @param q              optional search keyword applied to latest message text
     * @return paginated support conversations
     */
    @GetMapping("/admin/support/conversations")
    public PagedResponseDto<ConversationDto> getSupportConversations(
            @RequestParam(name = "supportAdminId", defaultValue = "1") Long supportAdminId,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "30") int size,
            @RequestParam(name = "q", required = false) String q) {
        return conversationService.getSupportConversations(supportAdminId, page, size, q);
    }

    /**
     * Creates a new conversation between two users, or returns the existing one
     * if a conversation already exists between them.
     * Participant types are optional; if omitted, they are resolved from the user table.
     *
     * @param user1Id   first participant's user ID
     * @param user1Type first participant's type (optional, e.g. PASSENGER)
     * @param user2Id   second participant's user ID
     * @param user2Type second participant's type (optional)
     * @return the conversation DTO
     */
    @PostMapping("/conversations")
    public ConversationDto createOrGetConversation(
            @RequestParam("user1Id") Long user1Id,
            @RequestParam(name = "user1Type", required = false) String user1Type,
            @RequestParam("user2Id") Long user2Id,
            @RequestParam(name = "user2Type", required = false) String user2Type) {
        return conversationService.getOrCreateConversation(
                user1Id, user1Type, user2Id, user2Type);
    }
}

