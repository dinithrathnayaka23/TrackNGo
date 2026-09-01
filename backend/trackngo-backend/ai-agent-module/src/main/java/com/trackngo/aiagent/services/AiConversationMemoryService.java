package com.trackngo.aiagent.services;

import com.trackngo.aiagent.context.AgentExecutionContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@Slf4j
public class AiConversationMemoryService {
    private final JdbcTemplate jdbc;

    public AiConversationMemoryService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void recordMessage(String chatId, String role, String content) {
        if (isBlank(chatId) || isBlank(role) || isBlank(content)) {
            return;
        }
        AgentExecutionContext.Context context = AgentExecutionContext.get();
        try {
            jdbc.update("""
                    INSERT INTO ai_chat_message (chat_id, user_id, user_email, role, content, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    chatId,
                    context != null ? context.userId() : null,
                    context != null ? context.email() : null,
                    role,
                    content,
                    LocalDateTime.now());
        } catch (DataAccessException ex) {
            log.warn("Unable to persist AI chat message for chatId {}: {}", chatId, ex.getMessage());
        }
    }

    /**
     * The most recent thing said in this conversation by the given role.
     *
     * Lets the router see what it last asked for, so a reply that only supplies the
     * missing detail can be understood as continuing that request rather than being
     * classified on its own words. Call before recording the current turn.
     */
    public Optional<String> lastMessageByRole(String chatId, String role) {
        if (isBlank(chatId) || isBlank(role)) {
            return Optional.empty();
        }
        try {
            List<String> rows = jdbc.query("""
                    SELECT content
                    FROM ai_chat_message
                    WHERE chat_id = ? AND role = ?
                    ORDER BY created_at DESC, ai_chat_message_id DESC
                    LIMIT 1
                    """,
                    (rs, rowNum) -> rs.getString("content"),
                    chatId,
                    role);
            return rows.isEmpty() ? Optional.empty() : Optional.ofNullable(rows.get(0));
        } catch (DataAccessException ex) {
            log.warn("Unable to read last {} message for chatId {}: {}", role, chatId, ex.getMessage());
            return Optional.empty();
        }
    }

    public String recentConversationDigest(String chatId, int limit) {
        if (isBlank(chatId)) {
            return "";
        }
        try {
            List<String> rows = jdbc.query("""
                    SELECT role, content
                    FROM ai_chat_message
                    WHERE chat_id = ?
                    ORDER BY created_at DESC, ai_chat_message_id DESC
                    LIMIT ?
                    """,
                    (rs, rowNum) -> rs.getString("role") + ": " + truncate(rs.getString("content"), 240),
                    chatId,
                    Math.max(1, limit));
            if (rows.isEmpty()) {
                return "";
            }
            StringBuilder digest = new StringBuilder("Recent conversation, newest first:\n");
            rows.forEach(row -> digest.append("- ").append(row).append('\n'));
            return digest.toString();
        } catch (DataAccessException ex) {
            log.warn("Unable to read AI chat memory for chatId {}: {}", chatId, ex.getMessage());
            return "";
        }
    }

    public void recordInteraction(String chatId, String intent, String status, int latencyMs, String model, String errorMessage) {
        try {
            AgentExecutionContext.Context context = AgentExecutionContext.get();
            jdbc.update("""
                    INSERT INTO ai_agent_interaction
                        (chat_id, user_id, user_email, detected_intent, status, latency_ms, model_name, error_message, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    chatId,
                    context != null ? context.userId() : null,
                    context != null ? context.email() : null,
                    intent,
                    status,
                    latencyMs,
                    model,
                    errorMessage,
                    LocalDateTime.now());
        } catch (DataAccessException ex) {
            log.warn("Unable to persist AI interaction for chatId {}: {}", chatId, ex.getMessage());
        }
    }

    public void recordFeedback(String chatId, Long messageId, Long userId, int rating, String comment) {
        if (isBlank(chatId)) {
            return;
        }
        int boundedRating = Math.max(1, Math.min(5, rating));
        try {
            jdbc.update("""
                    INSERT INTO ai_feedback (chat_id, ai_chat_message_id, user_id, rating, comment, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """, chatId, messageId, userId, boundedRating, comment, LocalDateTime.now());
        } catch (DataAccessException ex) {
            log.warn("Unable to persist AI feedback for chatId {}: {}", chatId, ex.getMessage());
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String truncate(String value, int max) {
        if (value == null || value.length() <= max) {
            return value;
        }
        return value.substring(0, max - 3) + "...";
    }
}
