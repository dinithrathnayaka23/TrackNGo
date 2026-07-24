package com.trackngo.aiagent.orchestration;

import com.trackngo.aiagent.context.AgentExecutionContext;
import com.trackngo.aiagent.agents.TripPlanningAgent;
import com.trackngo.aiagent.agents.TrafficEtaAgent;
import com.trackngo.aiagent.dto.ComplaintAnalysisRequest;
import com.trackngo.aiagent.dto.ComplaintAnalysisResponse;
import com.trackngo.aiagent.dto.RecommendationRequest;
import com.trackngo.aiagent.dto.RecommendationResponse;
import com.trackngo.aiagent.services.AiConversationMemoryService;
import com.trackngo.aiagent.services.AiGroundingService;
import com.trackngo.aiagent.services.ComplaintAgentService;
import com.trackngo.aiagent.services.RecommendationAgentService;
import com.trackngo.aiagent.services.TrafficEtaAgentService;
import com.trackngo.aiagent.services.TripPlanningAgentService;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import lombok.extern.slf4j.Slf4j;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Slf4j
public class AgentRouter {

    private final ChatClient primaryChatClient;
    private final String fallbackModelName;
    private final String primaryModelName;
    private final AiConversationMemoryService memoryService;
    private final AiGroundingService groundingService;
    private final TripPlanningAgentService tripPlanningAgentService;
    private final TrafficEtaAgentService trafficEtaAgentService;
    private final ComplaintAgentService complaintAgentService;
    private final RecommendationAgentService recommendationAgentService;
    private final int modelTimeoutSeconds;
    private final boolean modelFunctionsEnabled;
    private final boolean directHttpModelEnabled;
    private final String modelApiKey;
    private final String modelBaseUrl;
    private final RestClient restClient;

    public AgentRouter(
            ChatClient chatClient,
            @Value("${spring.ai.openai.chat.options.model:gemini-1.5-pro}") String primaryModelName,
            @Value("${ai.fallback.model:gemini-1.5-flash}") String fallbackModelName,
            @Value("${ai.model.timeout-seconds:12}") int modelTimeoutSeconds,
            @Value("${ai.model.functions-enabled:false}") boolean modelFunctionsEnabled,
            @Value("${ai.model.direct-http-enabled:true}") boolean directHttpModelEnabled,
            @Value("${spring.ai.openai.api-key:}") String modelApiKey,
            @Value("${spring.ai.openai.base-url:}") String modelBaseUrl,
            AiConversationMemoryService memoryService,
            AiGroundingService groundingService,
            TripPlanningAgentService tripPlanningAgentService,
            TrafficEtaAgentService trafficEtaAgentService,
            ComplaintAgentService complaintAgentService,
            RecommendationAgentService recommendationAgentService) {
        this.primaryChatClient = chatClient;
        this.primaryModelName = primaryModelName;
        this.fallbackModelName = fallbackModelName;
        this.modelTimeoutSeconds = modelTimeoutSeconds;
        this.modelFunctionsEnabled = modelFunctionsEnabled;
        this.directHttpModelEnabled = directHttpModelEnabled;
        this.modelApiKey = modelApiKey;
        this.modelBaseUrl = modelBaseUrl;
        this.restClient = RestClient.builder().build();
        this.memoryService = memoryService;
        this.groundingService = groundingService;
        this.tripPlanningAgentService = tripPlanningAgentService;
        this.trafficEtaAgentService = trafficEtaAgentService;
        this.complaintAgentService = complaintAgentService;
        this.recommendationAgentService = recommendationAgentService;
    }

    public String processUserQuery(String userQuery, String chatId) {
        if (userQuery == null || userQuery.isBlank()) {
            return "Please tell me what you need help with, for example: find a bus from Colombo Fort to Kandy tomorrow morning.";
        }

        long startedAt = System.nanoTime();
        String detectedIntent = detectIntent(userQuery);
        memoryService.recordMessage(chatId, "user", userQuery);

        Optional<String> deterministicReply = tryDeterministicToolPath(userQuery, chatId, detectedIntent);
        if (deterministicReply.isPresent()) {
            String reply = deterministicReply.get();
            memoryService.recordMessage(chatId, "assistant", reply);
            memoryService.recordInteraction(chatId, detectedIntent, "SUCCESS_DIRECT_TOOL", elapsedMs(startedAt), "deterministic-router", null);
            return reply;
        }

        try {
            log.info("Processing query with primary model. ChatId: {}", chatId);
            String enrichedPrompt = buildPrompt(userQuery, chatId);
            String reply = callModelWithTimeout(() -> callPrimaryModel(enrichedPrompt, chatId));
            memoryService.recordMessage(chatId, "assistant", reply);
            memoryService.recordInteraction(chatId, detectedIntent, "SUCCESS", elapsedMs(startedAt), primaryModelName, null);
            return reply;
        } catch (Exception e) {
            log.warn("Primary model failed: {}. Falling back to model: {}", e.getMessage(), fallbackModelName);
            try {
                String enrichedPrompt = buildPrompt(userQuery, chatId);
                String reply = callModelWithTimeout(() -> callFallbackModel(enrichedPrompt, chatId));
                memoryService.recordMessage(chatId, "assistant", reply);
                memoryService.recordInteraction(chatId, detectedIntent, "FALLBACK_SUCCESS", elapsedMs(startedAt), fallbackModelName, e.getMessage());
                return reply;
            } catch (Exception ex) {
                log.error("Fallback model also failed: {}", ex.getMessage());
                String reply = deterministicFallback(userQuery);
                memoryService.recordMessage(chatId, "assistant", reply);
                memoryService.recordInteraction(chatId, detectedIntent, "FAILED_FALLBACK_USED", elapsedMs(startedAt), fallbackModelName, ex.getMessage());
                return reply;
            }
        }
    }

    private Optional<String> tryDeterministicToolPath(String userQuery, String chatId, String detectedIntent) {
        return switch (detectedIntent) {
            case "TRIP_PLANNING" -> parseRouteRequest(userQuery)
                    .map(tripPlanningAgentService::findRoutes)
                    .map(this::formatRouteResponse);
            case "BOOKING" -> Optional.of(handleBookingIntent(userQuery));
            case "ETA" -> parseBusReference(userQuery)
                    .map(busId -> trafficEtaAgentService.getLiveEta(new TrafficEtaAgent.EtaRequest(busId)))
                    .map(this::formatEtaResponse);
            case "COMPLAINT" -> Optional.of(formatComplaintResponse(complaintAgentService.analyzeComplaint(
                    new ComplaintAnalysisRequest(userQuery, currentUserId(), "mobile"))));
            case "RECOMMENDATION" -> Optional.of(formatRecommendationResponse(recommendationAgentService.generateRecommendations(
                    new RecommendationRequest(currentUserId(), userQuery, userQuery, List.of()))));
            default -> Optional.empty();
        };
    }

    private String handleBookingIntent(String userQuery) {
        Optional<TripPlanningAgent.RouteRequest> routeRequest = parseRouteRequest(userQuery);
        if (routeRequest.isPresent()) {
            TripPlanningAgent.RouteResponse response = tripPlanningAgentService.findRoutes(routeRequest.get());
            return formatRouteResponse(response)
                    + "\n\nTo create the booking, send the bus id or bus number, seat numbers, passenger name, and confirm that I should reserve the seats. I will not create a booking or reference number until those details are confirmed.";
        }
        return "I can help with the booking, but I need the source, destination, travel date, preferred bus or bus number, and seat count. Example: book 2 seats on NB-0012 from Colombo Fort to Kandy on 2026-07-24.";
    }

    private Optional<String> parseBusReference(String userQuery) {
        Matcher busNumber = Pattern.compile("(?i)\\b[A-Z]{1,3}-\\d{3,5}\\b").matcher(userQuery);
        if (busNumber.find()) {
            return Optional.of(busNumber.group().toUpperCase());
        }
        Matcher numericBus = Pattern.compile("(?i)\\bbus\\s+(\\d+)\\b").matcher(userQuery);
        if (numericBus.find()) {
            return Optional.of("bus " + numericBus.group(1));
        }
        return Optional.empty();
    }

    private String formatEtaResponse(TrafficEtaAgent.EtaResponse response) {
        return "%s\nDelay estimate: %d minutes\nLocation: %s\nConfidence: %s | Source: %s".formatted(
                response.message(),
                response.estimatedDelayMinutes(),
                response.currentLocation(),
                response.confidence(),
                response.source());
    }

    private String formatComplaintResponse(ComplaintAnalysisResponse response) {
        return "Complaint triage complete.\nCategory: %s\nPriority: %s\nAssigned team: %s\nSuggested action: %s\nSummary: %s".formatted(
                response.category(),
                response.priority(),
                response.routingTarget(),
                response.suggestedAction(),
                response.summary());
    }

    private String formatRecommendationResponse(RecommendationResponse response) {
        return "Recommendations:\n- %s\n\nReasoning: %s\nConfidence: %s".formatted(
                String.join("\n- ", response.recommendations()),
                response.reasoning(),
                response.confidence());
    }

    private String currentUserId() {
        AgentExecutionContext.Context context = AgentExecutionContext.get();
        return context != null && context.hasUser() ? String.valueOf(context.userId()) : "anonymous";
    }

    private String callPrimaryModel(String enrichedPrompt, String chatId) {
        if (directHttpModelEnabled) {
            return callOpenAiCompatibleModel(enrichedPrompt, primaryModelName);
        }
        var request = primaryChatClient.prompt()
                .user(enrichedPrompt)
                .advisors(a -> a.param("chat_memory_conversation_id", chatId));
        if (modelFunctionsEnabled) {
            request = request.functions("findRoutes", "reserveSeat", "getLiveEta", "sendNotification", "analyzeComplaint", "generateRecommendations");
        }
        return request.call().content();
    }

    private String callFallbackModel(String enrichedPrompt, String chatId) {
        if (directHttpModelEnabled) {
            return callOpenAiCompatibleModel(enrichedPrompt, fallbackModelName);
        }
        var request = primaryChatClient.prompt()
                .user(enrichedPrompt)
                .advisors(a -> a.param("chat_memory_conversation_id", chatId))
                .options(org.springframework.ai.openai.OpenAiChatOptions.builder()
                        .withModel(fallbackModelName)
                        .build());
        if (modelFunctionsEnabled) {
            request = request.functions("findRoutes", "reserveSeat", "getLiveEta", "sendNotification", "analyzeComplaint", "generateRecommendations");
        }
        return request.call().content();
    }

    private String callOpenAiCompatibleModel(String enrichedPrompt, String modelName) {
        if (modelApiKey == null || modelApiKey.isBlank()) {
            throw new IllegalStateException("AI API key is not configured");
        }
        if (modelBaseUrl == null || modelBaseUrl.isBlank()) {
            throw new IllegalStateException("AI base URL is not configured");
        }

        DirectChatResponse response = restClient.post()
                .uri(chatCompletionsUrl())
                .headers(headers -> headers.setBearerAuth(modelApiKey))
                .body(Map.of(
                        "model", modelName,
                        "messages", List.of(
                                Map.of("role", "system", "content", "You are TrackNGo AI, a concise Sri Lankan bus travel assistant."),
                                Map.of("role", "user", "content", enrichedPrompt)
                        ),
                        "temperature", 0.3
                ))
                .retrieve()
                .body(DirectChatResponse.class);

        if (response == null || response.choices() == null || response.choices().isEmpty()
                || response.choices().get(0).message() == null
                || response.choices().get(0).message().content() == null
                || response.choices().get(0).message().content().isBlank()) {
            throw new IllegalStateException("AI provider returned an empty response");
        }
        return response.choices().get(0).message().content().trim();
    }

    private String chatCompletionsUrl() {
        String trimmed = modelBaseUrl.trim();
        String base = trimmed.endsWith("/") ? trimmed.substring(0, trimmed.length() - 1) : trimmed;
        if (base.endsWith("/chat/completions")) {
            return base;
        }
        return base + "/chat/completions";
    }

    private record DirectChatResponse(List<DirectChatChoice> choices) {}
    private record DirectChatChoice(DirectChatMessage message) {}
    private record DirectChatMessage(String content) {}

    private String callModelWithTimeout(ModelCall modelCall) throws Exception {
        CompletableFuture<String> future = CompletableFuture.supplyAsync(() -> {
            try {
                return modelCall.call();
            } catch (Exception e) {
                throw new ModelCallRuntimeException(e);
            }
        });
        try {
            return future.get(modelTimeoutSeconds, TimeUnit.SECONDS);
        } catch (TimeoutException e) {
            future.cancel(true);
            throw new TimeoutException("AI model call timed out after " + modelTimeoutSeconds + " seconds");
        } catch (ModelCallRuntimeException e) {
            throw e.unwrap();
        } catch (java.util.concurrent.ExecutionException e) {
            Throwable cause = e.getCause();
            if (cause instanceof ModelCallRuntimeException modelException) {
                throw modelException.unwrap();
            }
            throw e;
        }
    }

    @FunctionalInterface
    private interface ModelCall {
        String call() throws Exception;
    }

    private static class ModelCallRuntimeException extends RuntimeException {
        ModelCallRuntimeException(Exception cause) {
            super(cause);
        }

        Exception unwrap() {
            return (Exception) getCause();
        }
    }

    private Optional<TripPlanningAgent.RouteRequest> parseRouteRequest(String userQuery) {
        String query = userQuery == null ? "" : userQuery.trim();
        Pattern pattern = Pattern.compile("(?i)\\bfrom\\s+(.+?)\\s+to\\s+(.+?)(?:\\s+(today|tomorrow|\\d{4}-\\d{2}-\\d{2}|morning|afternoon|evening|night)\\b|$)");
        Matcher matcher = pattern.matcher(query);
        if (!matcher.find()) {
            return Optional.empty();
        }

        String source = cleanupPlace(matcher.group(1));
        String destination = cleanupPlace(matcher.group(2));
        String date = "today";
        String preferredTime = null;
        String lower = query.toLowerCase();
        if (lower.contains("tomorrow")) {
            date = "tomorrow";
        } else if (lower.contains("today")) {
            date = "today";
        } else {
            Matcher dateMatcher = Pattern.compile("\\b\\d{4}-\\d{2}-\\d{2}\\b").matcher(query);
            if (dateMatcher.find()) {
                date = dateMatcher.group();
            }
        }
        if (lower.contains("morning")) {
            preferredTime = "morning";
        } else if (lower.contains("afternoon")) {
            preferredTime = "afternoon";
        } else if (lower.contains("evening")) {
            preferredTime = "evening";
        } else if (lower.contains("night")) {
            preferredTime = "night";
        }

        if (source.isBlank() || destination.isBlank()) {
            return Optional.empty();
        }
        return Optional.of(new TripPlanningAgent.RouteRequest(source, destination, date, null, preferredTime));
    }

    private String cleanupPlace(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replaceAll("(?i)\\b(bus|buses|route|routes|find|search|show|me)\\b", "")
                .replaceAll("[?.!,]+$", "")
                .trim();
    }

    private String formatRouteResponse(TripPlanningAgent.RouteResponse response) {
        if (response.routes() == null || response.routes().isEmpty()) {
            return "I could not find matching TrackNGo buses for that route. Try exact stop names like Colombo Fort, Kandy, Galle, Matara, Jaffna, or Negombo.";
        }

        StringBuilder builder = new StringBuilder("I found these TrackNGo options:\n");
        for (int i = 0; i < response.routes().size(); i++) {
            builder.append(i + 1).append(". ").append(response.routes().get(i)).append('\n');
        }
        builder.append("\nConfidence: ").append(response.confidence())
                .append(" | Source: ").append(response.source());
        return builder.toString();
    }

    private String buildPrompt(String userQuery, String chatId) {
        AgentExecutionContext.Context context = AgentExecutionContext.get();
        String userContext = context == null || !context.hasUser()
                ? "No authenticated passenger context is available. Ask for passenger id before creating paid bookings."
                : "Authenticated user id %d, email %s, role %s. Prefer this passenger id for bookings unless the user says otherwise."
                    .formatted(context.userId(), context.email(), context.role());

        return """
                You are TrackNGo AI, a production travel assistant for a Sri Lankan bus booking platform.
                Use Sri Lankan places, LKR fares, local operators, and practical transport wording.
                Prefer tool results and database facts over general model knowledge. If confidence is low, say what is missing.
                For bookings, never invent a confirmation number; use reserveSeat and report its exact result.
                For delays, combine getLiveEta with route alternatives where useful.
                When multiple agents/tools contribute, summarize their contributions in concise labels.
                Today is 2026-07-23 in Sri Lanka.

                User context:
                %s

                %s
                %s
                User request:
                %s
                """.formatted(
                userContext,
                memoryService.recentConversationDigest(chatId, 8),
                groundingService.buildGroundingDigest(userQuery),
                userQuery);
    }

    private String deterministicFallback(String userQuery) {
        String lower = userQuery.toLowerCase();
        if (lower.contains("book") || lower.contains("seat")) {
            return "I could not reach the AI model, but booking is still available through the TrackNGo booking flow. Tell me the bus number, route, date, boarding stop, destination stop, and seat count so I can retry with the booking tool.";
        }
        if (lower.contains("route") || lower.contains("bus") || lower.contains("travel")) {
            return "I could not reach the AI model, but TrackNGo currently supports Sri Lankan route discovery such as Colombo Fort to Kandy, Galle, Matara, Jaffna, Negombo, and Kandy to Nuwara Eliya. Share your source, destination, date, and preferred time so I can retry the live search.";
        }
        return "I am having trouble reaching the AI model right now. I can still help with Sri Lankan route search, booking, live ETA, complaints, or notifications once the model connection recovers.";
    }

    private String detectIntent(String query) {
        String lower = query.toLowerCase();
        if (lower.contains("book") || lower.contains("seat") || lower.contains("reserve")) {
            return "BOOKING";
        }
        if (lower.contains("delay") || lower.contains("eta") || lower.contains("late") || lower.contains("traffic")) {
            return "ETA";
        }
        if (lower.contains("complaint") || lower.contains("refund") || lower.contains("rude") || lower.contains("unsafe")) {
            return "COMPLAINT";
        }
        if (lower.contains("recommend") || lower.contains("suggest") || lower.contains("offer")) {
            return "RECOMMENDATION";
        }
        if (lower.contains("notify") || lower.contains("remind")) {
            return "NOTIFICATION";
        }
        if (lower.contains("route") || lower.contains("bus") || lower.contains("from")) {
            return "TRIP_PLANNING";
        }
        return "GENERAL";
    }

    private int elapsedMs(long startedAt) {
        return (int) ((System.nanoTime() - startedAt) / 1_000_000);
    }
}
