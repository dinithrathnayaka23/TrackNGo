package com.trackngo.aiagent.orchestration;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class AgentRouter {

    private final ChatClient primaryChatClient;
    private final String fallbackModelName;

    public AgentRouter(ChatClient chatClient, @Value("${ai.fallback.model:gemini-1.5-flash}") String fallbackModelName) {
        this.primaryChatClient = chatClient;
        this.fallbackModelName = fallbackModelName;
    }

    public String processUserQuery(String userQuery, String chatId) {
        try {
            log.info("Processing query with primary model. ChatId: {}", chatId);
            return primaryChatClient.prompt()
                    .user(userQuery)
                    .advisors(a -> a.param("chat_memory_conversation_id", chatId))
                    .functions("findRoutes", "reserveSeat", "getLiveEta", "sendNotification", "analyzeComplaint", "generateRecommendations") // Agent tools
                    .call()
                    .content();
        } catch (Exception e) {
            log.warn("Primary model failed: {}. Falling back to model: {}", e.getMessage(), fallbackModelName);
            // Fallback logic: we use the same ChatClient builder but override the model name for the call
            try {
                return primaryChatClient.prompt()
                        .user(userQuery)
                        .advisors(a -> a.param("chat_memory_conversation_id", chatId))
                        .functions("findRoutes", "reserveSeat", "getLiveEta", "sendNotification", "analyzeComplaint", "generateRecommendations") // Agent tools
                        // Override the model at request level for fallback
                        .options(org.springframework.ai.openai.OpenAiChatOptions.builder()
                                .withModel(fallbackModelName)
                                .build())
                        .call()
                        .content();
            } catch (Exception ex) {
                log.error("Fallback model also failed: {}", ex.getMessage());
                return "I am currently unable to process your request due to system unavailability. Please try again later.";
            }
        }
    }
}
