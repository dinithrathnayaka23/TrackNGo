package com.trackngo.aiagent.controller;

import com.trackngo.aiagent.context.AgentExecutionContext;
import com.trackngo.aiagent.orchestration.AgentRouter;
import com.trackngo.aiagent.services.AiConversationMemoryService;
import org.springframework.dao.DataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ai")
public class ChatController {

    private final AgentRouter agentRouter;
    private final JdbcTemplate jdbcTemplate;
    private final AiConversationMemoryService memoryService;

    public ChatController(AgentRouter agentRouter, JdbcTemplate jdbcTemplate, AiConversationMemoryService memoryService) {
        this.agentRouter = agentRouter;
        this.jdbcTemplate = jdbcTemplate;
        this.memoryService = memoryService;
    }

    public record ChatRequest(String message, String chatId, Long userId) {}
    public record ChatResponse(String reply, String chatId) {}
    public record FeedbackRequest(String chatId, Long messageId, Long userId, int rating, String comment) {}

    @PostMapping("/chat")
    public ResponseEntity<ChatResponse> chat(@RequestBody ChatRequest request, Authentication authentication) {
        String chatId = request.chatId() != null && !request.chatId().isBlank()
                ? request.chatId()
                : "chat-" + UUID.randomUUID();
        AgentExecutionContext.set(resolveContext(chatId, request.userId(), authentication));
        try {
            String reply = agentRouter.processUserQuery(request.message(), chatId);
            return ResponseEntity.ok(new ChatResponse(reply, chatId));
        } finally {
            AgentExecutionContext.clear();
        }
    }

    @PostMapping("/feedback")
    public ResponseEntity<Void> feedback(@RequestBody FeedbackRequest request, Authentication authentication) {
        AgentExecutionContext.Context context = resolveContext(request.chatId(), request.userId(), authentication);
        Long userId = request.userId() != null ? request.userId() : context.userId();
        memoryService.recordFeedback(request.chatId(), request.messageId(), userId, request.rating(), request.comment());
        return ResponseEntity.noContent().build();
    }

    private AgentExecutionContext.Context resolveContext(String chatId, Long requestedUserId, Authentication authentication) {
        if (authentication != null && authentication.isAuthenticated() && authentication.getName() != null) {
            try {
                return jdbcTemplate.queryForObject("""
                        SELECT user_id, email, user_type
                        FROM `user`
                        WHERE LOWER(email) = LOWER(?)
                        LIMIT 1
                        """,
                        (rs, rowNum) -> new AgentExecutionContext.Context(
                                rs.getLong("user_id"),
                                rs.getString("email"),
                                rs.getString("user_type"),
                                chatId),
                        authentication.getName());
            } catch (DataAccessException ignored) {
                return new AgentExecutionContext.Context(requestedUserId, authentication.getName(), "authenticated", chatId);
            }
        }

        if (requestedUserId != null) {
            try {
                return jdbcTemplate.queryForObject("""
                        SELECT user_id, email, user_type
                        FROM `user`
                        WHERE user_id = ?
                        LIMIT 1
                        """,
                        (rs, rowNum) -> new AgentExecutionContext.Context(
                                rs.getLong("user_id"),
                                rs.getString("email"),
                                rs.getString("user_type"),
                                chatId),
                        requestedUserId);
            } catch (DataAccessException ignored) {
                return new AgentExecutionContext.Context(requestedUserId, null, "passenger", chatId);
            }
        }

        return new AgentExecutionContext.Context(null, null, "anonymous", chatId);
    }
}
