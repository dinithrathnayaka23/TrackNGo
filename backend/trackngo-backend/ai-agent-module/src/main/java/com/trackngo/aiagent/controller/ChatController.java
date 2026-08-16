package com.trackngo.aiagent.controller;

import com.trackngo.aiagent.context.AgentExecutionContext;
import com.trackngo.aiagent.orchestration.AgentRouter;
import com.trackngo.aiagent.services.AiConversationMemoryService;
import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

@RestController
@RequestMapping("/api/v1/ai")
public class ChatController {

    private final AgentRouter agentRouter;
    private final JdbcTemplate jdbcTemplate;
    private final AiConversationMemoryService memoryService;
    private final ExecutorService chatExecutor;
    private final int chatTimeoutSeconds;

    public ChatController(
            AgentRouter agentRouter,
            JdbcTemplate jdbcTemplate,
            AiConversationMemoryService memoryService,
            @Value("${ai.chat.timeout-seconds:25}") int chatTimeoutSeconds) {
        this.agentRouter = agentRouter;
        this.jdbcTemplate = jdbcTemplate;
        this.memoryService = memoryService;
        this.chatTimeoutSeconds = Math.max(5, chatTimeoutSeconds);
        this.chatExecutor = Executors.newFixedThreadPool(4, new AiChatThreadFactory());
    }

    public record ChatRequest(String message, String chatId, Long userId, String language) {}
    public record ChatResponse(String reply, String chatId) {}
    public record FeedbackRequest(String chatId, Long messageId, Long userId, int rating, String comment) {}

    @PostMapping("/chat")
    public ResponseEntity<ChatResponse> chat(@RequestBody ChatRequest request, Authentication authentication) {
        String chatId = request.chatId() != null && !request.chatId().isBlank()
                ? request.chatId()
                : "chat-" + UUID.randomUUID();
        CompletableFuture<ChatResponse> responseFuture = CompletableFuture.supplyAsync(() -> {
            AgentExecutionContext.set(resolveContext(chatId, request.userId(), authentication));
            try {
                String reply = agentRouter.processUserQuery(request.message(), chatId, request.language());
                return new ChatResponse(reply, chatId);
            } finally {
                AgentExecutionContext.clear();
            }
        }, chatExecutor);

        try {
            return ResponseEntity.ok(responseFuture.get(chatTimeoutSeconds, TimeUnit.SECONDS));
        } catch (TimeoutException ex) {
            responseFuture.cancel(true);
            return ResponseEntity.ok(new ChatResponse(agentRouter.fallbackReply(request.message(), request.language()), chatId));
        } catch (InterruptedException ex) {
            responseFuture.cancel(true);
            Thread.currentThread().interrupt();
            return ResponseEntity.ok(new ChatResponse(agentRouter.fallbackReply(request.message(), request.language()), chatId));
        } catch (ExecutionException ex) {
            return ResponseEntity.ok(new ChatResponse(agentRouter.fallbackReply(request.message(), request.language()), chatId));
        }
    }

    @PostMapping("/feedback")
    public ResponseEntity<Void> feedback(@RequestBody FeedbackRequest request, Authentication authentication) {
        AgentExecutionContext.Context context = resolveContext(request.chatId(), request.userId(), authentication);
        Long userId = request.userId() != null ? request.userId() : context.userId();
        memoryService.recordFeedback(request.chatId(), request.messageId(), userId, request.rating(), request.comment());
        return ResponseEntity.noContent().build();
    }

    @PreDestroy
    void shutdownChatExecutor() {
        chatExecutor.shutdownNow();
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

    private static final class AiChatThreadFactory implements ThreadFactory {
        private int nextThreadNumber = 1;

        @Override
        public synchronized Thread newThread(Runnable runnable) {
            Thread thread = new Thread(runnable, "trackngo-ai-chat-" + nextThreadNumber++);
            thread.setDaemon(true);
            return thread;
        }
    }
}
