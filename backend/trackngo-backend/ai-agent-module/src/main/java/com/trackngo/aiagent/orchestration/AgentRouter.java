package com.trackngo.aiagent.orchestration;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.trackngo.aiagent.context.AgentExecutionContext;
import com.trackngo.aiagent.agents.NotificationAgent;
import com.trackngo.aiagent.agents.TripPlanningAgent;
import com.trackngo.aiagent.agents.TrafficEtaAgent;
import com.trackngo.aiagent.dto.ComplaintAnalysisRequest;
import com.trackngo.aiagent.dto.ComplaintAnalysisResponse;
import com.trackngo.aiagent.dto.RecommendationRequest;
import com.trackngo.aiagent.dto.RecommendationResponse;
import com.trackngo.aiagent.services.AdminOpsAgentService;
import com.trackngo.aiagent.services.AiConversationMemoryService;
import com.trackngo.aiagent.services.AiGroundingService;
import com.trackngo.aiagent.services.ComplaintAgentService;
import com.trackngo.aiagent.services.RecommendationAgentService;
import com.trackngo.aiagent.services.NotificationAgentService;
import com.trackngo.aiagent.services.TrafficEtaAgentService;
import com.trackngo.aiagent.services.TripPlanningAgentService;
import com.trackngo.booking.api.dto.BookingFlowDtos;
import com.trackngo.booking.internal.service.BookingFlowService;
import com.trackngo.complaint.api.ComplaintService;
import com.trackngo.complaint.api.dto.ComplaintDto;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import lombok.extern.slf4j.Slf4j;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Locale;
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

    /**
     * Asked when a passenger describes a problem but has not named the trip it
     * happened on. Held as a constant because the next turn is matched against it to
     * recognise the passenger answering the question.
     */
    private static final String COMPLAINT_REFERENCE_PROMPT =
            "I can submit this complaint for admin review. Please send the booking reference for the past trip, "
            + "for example BK-20250501-ABCD, and include any extra details you want admin to see.";

    /** Mirrors MAX_DESCRIPTION_LENGTH in ComplaintServiceImpl, which rejects anything longer. */
    private static final int COMPLAINT_DESCRIPTION_LIMIT = 500;

    /** "from X to Y" — the shape of a concrete journey request. */
    private static final Pattern ROUTE_MENTION = Pattern.compile("(?i)\\bfrom\\s+.+?\\s+to\\s+.+");

    /** A bus registration such as NB-0012, which only appears in operational questions. */
    private static final Pattern BUS_MENTION = Pattern.compile("(?i)\\b[a-z]{2}-?\\d{3,4}\\b");

    private final ChatClient primaryChatClient;
    private final String fallbackModelName;
    private final String primaryModelName;
    private final AiConversationMemoryService memoryService;
    private final AiGroundingService groundingService;
    private final TripPlanningAgentService tripPlanningAgentService;
    private final TrafficEtaAgentService trafficEtaAgentService;
    private final ComplaintAgentService complaintAgentService;
    private final ComplaintService complaintSubmissionService;
    private final RecommendationAgentService recommendationAgentService;
    private final NotificationAgentService notificationAgentService;
    private final BookingFlowService bookingFlowService;
    private final AdminOpsAgentService adminOpsAgentService;
    private final JdbcTemplate jdbcTemplate;
    private final int modelTimeoutSeconds;
    private final boolean modelFunctionsEnabled;
    private final boolean directHttpModelEnabled;
    private final String modelApiKey;
    private final String modelBaseUrl;
    private final RestClient restClient;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public AgentRouter(
            ChatClient chatClient,
            @Value("${spring.ai.openai.chat.options.model:gemini-1.5-pro}") String primaryModelName,
            @Value("${ai.fallback.model:gemini-1.5-flash}") String fallbackModelName,
            @Value("${ai.model.timeout-seconds:12}") int modelTimeoutSeconds,
            @Value("${ai.model.functions-enabled:false}") boolean modelFunctionsEnabled,
            @Value("${ai.model.direct-http-enabled:true}") boolean directHttpModelEnabled,
            @Value("${spring.ai.openai.api-key:}") String modelApiKey,
            @Value("${spring.ai.openai.base-url:}") String modelBaseUrl,
            ObjectMapper objectMapper,
            AiConversationMemoryService memoryService,
            AiGroundingService groundingService,
            TripPlanningAgentService tripPlanningAgentService,
            TrafficEtaAgentService trafficEtaAgentService,
            ComplaintAgentService complaintAgentService,
            ComplaintService complaintSubmissionService,
            RecommendationAgentService recommendationAgentService,
            NotificationAgentService notificationAgentService,
            BookingFlowService bookingFlowService,
            AdminOpsAgentService adminOpsAgentService,
            JdbcTemplate jdbcTemplate) {
        this.primaryChatClient = chatClient;
        this.primaryModelName = primaryModelName;
        this.fallbackModelName = fallbackModelName;
        this.modelTimeoutSeconds = modelTimeoutSeconds;
        this.modelFunctionsEnabled = modelFunctionsEnabled;
        this.directHttpModelEnabled = directHttpModelEnabled;
        this.modelApiKey = modelApiKey;
        this.modelBaseUrl = modelBaseUrl;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(Math.max(1, modelTimeoutSeconds)))
                .build();
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        int timeoutMillis = Math.max(1, modelTimeoutSeconds) * 1000;
        requestFactory.setConnectTimeout(timeoutMillis);
        requestFactory.setReadTimeout(timeoutMillis);
        this.restClient = RestClient.builder()
                .requestFactory(requestFactory)
                .build();
        this.memoryService = memoryService;
        this.groundingService = groundingService;
        this.tripPlanningAgentService = tripPlanningAgentService;
        this.trafficEtaAgentService = trafficEtaAgentService;
        this.complaintAgentService = complaintAgentService;
        this.complaintSubmissionService = complaintSubmissionService;
        this.recommendationAgentService = recommendationAgentService;
        this.notificationAgentService = notificationAgentService;
        this.bookingFlowService = bookingFlowService;
        this.adminOpsAgentService = adminOpsAgentService;
        this.jdbcTemplate = jdbcTemplate;
    }

    public String processUserQuery(String userQuery, String chatId) {
        return processUserQuery(userQuery, chatId, "en");
    }

    public String processUserQuery(String userQuery, String chatId, String language) {
        String responseLanguage = normalizeLanguage(language);
        if (userQuery == null || userQuery.isBlank()) {
            return "si".equals(responseLanguage)
                    ? "කරුණාකර ඔබට අවශ්‍ය සහාය කියන්න. උදාහරණයක් ලෙස: හෙට උදෑසන කොළඹ කොටුවේ සිට මහනුවරට බසයක් සොයන්න."
                    : "Please tell me what you need help with, for example: find a bus from Colombo Fort to Kandy tomorrow morning.";
        }

        long startedAt = System.nanoTime();

        // Checked before the current turn is recorded, so the lookup sees the
        // previous exchange rather than this message.
        Optional<String> complaintFollowUp = complaintContinuation(userQuery, chatId);
        String routedQuery = complaintFollowUp.orElse(userQuery);

        // A signed-in admin gets the operations agent, and their question is read the
        // same way a passenger's is. The role is what keeps operational figures out of
        // passenger replies, rather than the wording of the question: gating on
        // keywords meant "admin dashboard summary" worked while "give me today's
        // numbers" did not, and every admin question that did match returned the same
        // fixed block regardless of what was asked.
        if (isAdminContext()) {
            String adminReply = handleAdminQuery(userQuery, chatId);
            memoryService.recordMessage(chatId, "user", userQuery);
            memoryService.recordMessage(chatId, "assistant", adminReply);
            memoryService.recordInteraction(chatId, "ADMIN_OPS", "SUCCESS_DIRECT_TOOL",
                    elapsedMs(startedAt), "admin-ops-agent", null);
            return adminReply;
        }

        Understanding understanding = complaintFollowUp.isPresent()
                ? new Understanding("COMPLAINT", null, null, null)
                : understand(userQuery, chatId);
        String detectedIntent = understanding.intent();

        memoryService.recordMessage(chatId, "user", userQuery);

        Optional<String> deterministicReply =
                tryDeterministicToolPath(routedQuery, chatId, detectedIntent, understanding);
        if (deterministicReply.isPresent()) {
            String reply = deterministicReply.get();
            memoryService.recordMessage(chatId, "assistant", reply);
            memoryService.recordInteraction(chatId, detectedIntent, "SUCCESS_DIRECT_TOOL", elapsedMs(startedAt), "deterministic-router", null);
            return reply;
        }

        try {
            log.info("Processing query with primary model. ChatId: {}", chatId);
            String enrichedPrompt = buildPrompt(userQuery, chatId, responseLanguage);
            String reply = callModelWithTimeout(() -> callPrimaryModel(enrichedPrompt, chatId));
            memoryService.recordMessage(chatId, "assistant", reply);
            memoryService.recordInteraction(chatId, detectedIntent, "SUCCESS", elapsedMs(startedAt), primaryModelName, null);
            return reply;
        } catch (Exception e) {
            log.warn("Primary model failed: {}. Falling back to model: {}", e.getMessage(), fallbackModelName);
            if (sameModelName(primaryModelName, fallbackModelName)) {
                String reply = deterministicFallback(userQuery, responseLanguage);
                memoryService.recordMessage(chatId, "assistant", reply);
                memoryService.recordInteraction(chatId, detectedIntent, "FAILED_FALLBACK_USED", elapsedMs(startedAt), primaryModelName, e.getMessage());
                return reply;
            }
            try {
                String enrichedPrompt = buildPrompt(userQuery, chatId, responseLanguage);
                String reply = callModelWithTimeout(() -> callFallbackModel(enrichedPrompt, chatId));
                memoryService.recordMessage(chatId, "assistant", reply);
                memoryService.recordInteraction(chatId, detectedIntent, "FALLBACK_SUCCESS", elapsedMs(startedAt), fallbackModelName, e.getMessage());
                return reply;
            } catch (Exception ex) {
                log.error("Fallback model also failed: {}", ex.getMessage());
                String reply = deterministicFallback(userQuery, responseLanguage);
                memoryService.recordMessage(chatId, "assistant", reply);
                memoryService.recordInteraction(chatId, detectedIntent, "FAILED_FALLBACK_USED", elapsedMs(startedAt), fallbackModelName, ex.getMessage());
                return reply;
            }
        }
    }

    public String fallbackReply(String userQuery) {
        return fallbackReply(userQuery, "en");
    }

    public String fallbackReply(String userQuery, String language) {
        return deterministicFallback(userQuery == null ? "" : userQuery, normalizeLanguage(language));
    }

    /**
     * Recognises a passenger supplying the booking reference the assistant just
     * asked for, and rebuilds the full complaint from both turns.
     *
     * Intent is otherwise decided from one message in isolation, so a reply of just
     * "BK-20260829-CAE6" matched no complaint keyword, fell through to the model,
     * and the model — which has no tools and no way to know that — announced the
     * complaint had been submitted. Nothing was ever written. Carrying the earlier
     * description forward means the reference arrives at the complaint agent with
     * the account of what happened still attached.
     */
    private Optional<String> complaintContinuation(String userQuery, String chatId) {
        if (parseBookingReference(userQuery).isEmpty()) {
            return Optional.empty();
        }
        boolean awaitingReference = memoryService.lastMessageByRole(chatId, "assistant")
                .map(COMPLAINT_REFERENCE_PROMPT::equals)
                .orElse(false);
        if (!awaitingReference) {
            return Optional.empty();
        }
        String description = memoryService.lastMessageByRole(chatId, "user").orElse("").trim();
        return Optional.of(description.isEmpty() ? userQuery : description + " " + userQuery.trim());
    }

    private Optional<String> tryDeterministicToolPath(
            String userQuery, String chatId, String detectedIntent, Understanding understanding) {
        ExtractedComplaint extractedComplaint = understanding == null ? null : understanding.complaint();
        return switch (detectedIntent) {
            case "TRIP_PLANNING" -> resolveRouteRequest(userQuery, understanding)
                    .map(tripPlanningAgentService::findRoutes)
                    .map(this::formatRouteResponse);
            case "BOOKING" -> Optional.of(handleBookingIntent(userQuery, understanding));
            case "ETA" -> resolveBusReference(userQuery, understanding)
                    .map(busId -> trafficEtaAgentService.getLiveEta(new TrafficEtaAgent.EtaRequest(busId)))
                    .map(this::formatEtaResponse);
            case "COMPLAINT" -> Optional.of(handleComplaintIntent(userQuery, extractedComplaint));
            case "RECOMMENDATION" -> Optional.of(formatRecommendationResponse(recommendationAgentService.generateRecommendations(
                    new RecommendationRequest(currentUserId(), userQuery, userQuery, List.of()))));
            case "NOTIFICATION" -> Optional.of(handleNotificationIntent(userQuery));
            default -> Optional.empty();
        };
    }

    private String handleNotificationIntent(String userQuery) {
        String lower = userQuery.toLowerCase(Locale.ROOT);
        String type = lower.contains("alternative") || lower.contains("disruption")
                ? "alternative_route"
                : lower.contains("delay") || lower.contains("late") || lower.contains("traffic")
                    ? "delay_alert"
                    : "reminder";
        String busId = parseBusReference(userQuery).orElse(null);
        Optional<TripPlanningAgent.RouteRequest> route = parseRouteRequest(userQuery);
        AgentExecutionContext.Context context = AgentExecutionContext.get();
        Long passengerId = context != null && context.hasUser() && "passenger".equalsIgnoreCase(context.role())
                ? context.userId()
                : null;
        Long driverId = context != null && context.hasUser() && "driver".equalsIgnoreCase(context.role())
                ? context.userId()
                : null;
        Long adminId = context != null && context.hasUser() && "admin".equalsIgnoreCase(context.role())
                ? context.userId()
                : null;

        NotificationAgent.NotificationResponse response = notificationAgentService.sendNotification(
                new NotificationAgent.NotificationRequest(
                        type,
                        busId,
                        userQuery,
                        route.map(TripPlanningAgent.RouteRequest::source).orElse(null),
                        route.map(TripPlanningAgent.RouteRequest::destination).orElse(null),
                        passengerId,
                        driverId,
                        adminId));
        String delivery = response.notificationId() == null
                ? "The message was prepared, but it was not saved to a notification inbox. Sign in as a passenger, driver, or admin with a configured database connection."
                : "The message was delivered to the signed-in user's notification inbox (ID: %d).".formatted(response.notificationId());
        return "**Notification prepared.**\n- **Type:** %s\n- **Message:** %s\n- **Delivery:** %s%s".formatted(
                response.type(),
                response.message(),
                delivery,
                response.suggestedRoute().isBlank() ? "" : "\n- **Suggested route:** " + response.suggestedRoute());
    }
    private String handleBookingIntent(String userQuery, Understanding understanding) {
        ParsedBookingRequest booking = parseNaturalLanguageBooking(userQuery);
        Optional<TripPlanningAgent.RouteRequest> routeRequest = resolveRouteRequest(userQuery, understanding);

        if (routeRequest.isEmpty()) {
            return "I can help you book in plain English. Please include **source**, **destination**, **travel date**, and **seat count**.\n\nExample: **Book 2 seats from Colombo Fort to Kandy tomorrow morning**.";
        }

        TripPlanningAgent.RouteRequest route = routeRequest.get();
        String travelDate = resolveTravelDate(route.date());
        List<BookingFlowDtos.BusSearchResult> buses = searchBookingOptions(route, travelDate);
        if (buses.isEmpty()) {
            return "I could not find active TrackNGo buses from **%s** to **%s** on **%s**. Try exact stop names such as Colombo Fort, Kandy, Galle, Matara, Jaffna, or Negombo.".formatted(
                    route.source(), route.destination(), travelDate);
        }

        if (!booking.confirmed()) {
            return formatBookingOptions(route, travelDate, buses, booking.seatCount())
                    + "\n\nTo finish the booking, reply like: **Confirm bus id %d seats 1A, 1B**. I will only create the booking after that confirmation.".formatted(buses.get(0).busId());
        }

        AgentExecutionContext.Context context = AgentExecutionContext.get();
        if (context == null || context.userId() == null) {
            return "I can prepare the booking, but please sign in first so I can attach it to your passenger account.";
        }

        if (booking.seatNumbers().isEmpty()) {
            return formatBookingOptions(route, travelDate, buses, booking.seatCount())
                    + "\n\nPlease choose the exact seats before I create the booking. Example: **Confirm bus id %d seats 1A, 1B**.".formatted(buses.get(0).busId());
        }

        Optional<BookingFlowDtos.BusSearchResult> selectedBus = selectBusForBooking(buses, booking);
        if (selectedBus.isEmpty()) {
            return formatBookingOptions(route, travelDate, buses, booking.seatNumbers().size())
                    + "\n\nI could not match that bus. Please use the **bus id** or **bus number** shown above.";
        }

        BookingFlowDtos.BusSearchResult bus = selectedBus.get();
        if (bus.availableSeats() < booking.seatNumbers().size()) {
            return "That bus currently has only **%d** seats available. Please choose fewer seats or another bus.".formatted(bus.availableSeats());
        }

        List<String> unavailableSeats = unavailableSeats(bus.busId(), travelDate, booking.seatNumbers());
        if (!unavailableSeats.isEmpty()) {
            return "These seats are not available on **%s** for **%s**: **%s**. Please choose different seats.".formatted(
                    bus.busNumber(), travelDate, String.join(", ", unavailableSeats));
        }

        BigDecimal totalAmount = bus.fee()
                .multiply(BigDecimal.valueOf(booking.seatNumbers().size()))
                .setScale(2, java.math.RoundingMode.HALF_UP);

        // The assistant has no way to take a card, so it reserves rather than sells:
        // the seats are held, the payment is left pending, and the passenger settles
        // it through the app's Stripe checkout. Reporting a paid booking here would
        // hand the passenger a ticket nobody had charged for.
        BookingFlowDtos.CreateBookingRequest request = new BookingFlowDtos.CreateBookingRequest(
                bus.busId(),
                travelDate,
                bus.startTime(),
                booking.seatNumbers(),
                "Reserved through TrackNGo AI natural-language booking. Payment pending.",
                "stripe",
                totalAmount,
                context.userId(),
                route.source(),
                route.destination(),
                totalAmount,
                BigDecimal.ZERO,
                null,
                null,
                null,
                true
        );

        try {
            BookingFlowDtos.BookingConfirmationResult created = bookingFlowService.createBooking(request);
            return """
                    **Seats reserved — payment still due.**
                    - **Reference:** %s
                    - **Bus:** %s
                    - **Route:** %s to %s
                    - **Date/time:** %s at %s
                    - **Seats:** %s
                    - **Amount due:** LKR %s

                    Your seats are held. Open **My Bookings** in the app and pay to confirm them.
                    """.formatted(
                    created.bookingReference(),
                    created.busNumber(),
                    created.fromLocation(),
                    created.toLocation(),
                    created.journeyDate(),
                    created.journeyTime(),
                    created.seatNumbers(),
                    created.totalAmount()).trim();
        } catch (RuntimeException ex) {
            return "I could not create the booking yet: %s. Please review the bus, seats, and fare, then try again.".formatted(ex.getMessage());
        }
    }

    private List<BookingFlowDtos.BusSearchResult> searchBookingOptions(TripPlanningAgent.RouteRequest route, String travelDate) {
        try {
            return bookingFlowService.searchBuses(route.source(), route.destination(), travelDate, route.busCategory())
                    .stream()
                    .filter(bus -> bus.availableSeats() > 0)
                    .limit(5)
                    .toList();
        } catch (RuntimeException ex) {
            log.warn("AI booking search failed: {}", ex.getMessage());
            return List.of();
        }
    }

    private String formatBookingOptions(TripPlanningAgent.RouteRequest route, String travelDate, List<BookingFlowDtos.BusSearchResult> buses, Integer requestedSeats) {
        StringBuilder builder = new StringBuilder("**I found these booking options:**\n");
        int seatCount = requestedSeats == null || requestedSeats < 1 ? 1 : requestedSeats;
        for (int i = 0; i < Math.min(3, buses.size()); i++) {
            BookingFlowDtos.BusSearchResult bus = buses.get(i);
            BigDecimal estimatedTotal = bus.fee().multiply(BigDecimal.valueOf(seatCount)).setScale(2, java.math.RoundingMode.HALF_UP);
            builder.append(i + 1)
                    .append(". **")
                    .append(bus.busNumber())
                    .append("** — bus id ")
                    .append(bus.busId())
                    .append(", ")
                    .append(route.source())
                    .append(" to ")
                    .append(route.destination())
                    .append(" on ")
                    .append(travelDate)
                    .append(", leaves ")
                    .append(bus.startTime())
                    .append(", ")
                    .append(bus.availableSeats())
                    .append(" seats available, estimated total **LKR ")
                    .append(estimatedTotal)
                    .append("** for ")
                    .append(seatCount)
                    .append(seatCount == 1 ? " seat." : " seats.")
                    .append('\n');
        }
        return builder.toString().trim();
    }

    private Optional<BookingFlowDtos.BusSearchResult> selectBusForBooking(List<BookingFlowDtos.BusSearchResult> buses, ParsedBookingRequest booking) {
        if (booking.busId() != null) {
            return buses.stream().filter(bus -> booking.busId().equals(bus.busId())).findFirst();
        }
        if (booking.busNumber() != null && !booking.busNumber().isBlank()) {
            return buses.stream().filter(bus -> booking.busNumber().equalsIgnoreCase(bus.busNumber())).findFirst();
        }
        return buses.size() == 1 ? Optional.of(buses.get(0)) : Optional.empty();
    }

    private List<String> unavailableSeats(Long busId, String travelDate, List<String> requestedSeats) {
        try {
            List<String> booked = bookingFlowService.getBookedSeats(busId, travelDate).stream().map(String::toUpperCase).toList();
            List<String> blocked = bookingFlowService.getBlockedSeats(busId).stream().map(String::toUpperCase).toList();
            return requestedSeats.stream()
                    .map(seat -> seat.toUpperCase(Locale.ROOT))
                    .filter(seat -> booked.contains(seat) || blocked.contains(seat))
                    .toList();
        } catch (RuntimeException ex) {
            log.warn("AI booking seat availability check failed: {}", ex.getMessage());
            return List.of();
        }
    }

    private ParsedBookingRequest parseNaturalLanguageBooking(String userQuery) {
        String query = userQuery == null ? "" : userQuery;
        String lower = query.toLowerCase(Locale.ROOT);
        List<String> seatNumbers = parseSeatNumbers(query);
        Integer seatCount = seatNumbers.isEmpty() ? parseSeatCount(query) : seatNumbers.size();
        Long busId = parseSelectedBusId(query).orElse(null);
        String busNumber = parseBusReference(query).orElse(null);
        String category = lower.contains("luxury") ? "luxury"
                : lower.contains("highway") || lower.contains("express") ? "highway"
                : lower.contains("semi") ? "semi_luxury"
                : null;
        return new ParsedBookingRequest(seatNumbers, seatCount, busId, busNumber, category, isExplicitBookingConfirmation(lower));
    }

    private List<String> parseSeatNumbers(String query) {
        Matcher matcher = Pattern.compile("(?i)\\b\\d{1,2}[A-F]\\b").matcher(query == null ? "" : query);
        java.util.ArrayList<String> seats = new java.util.ArrayList<>();
        while (matcher.find()) {
            String seat = matcher.group().toUpperCase(Locale.ROOT);
            if (!seats.contains(seat)) {
                seats.add(seat);
            }
        }
        return seats;
    }

    private Integer parseSeatCount(String query) {
        String lower = query == null ? "" : query.toLowerCase(Locale.ROOT);
        Matcher matcher = Pattern.compile("\\b(\\d+)\\s+(?:seat|seats|ticket|tickets)\\b").matcher(lower);
        if (matcher.find()) {
            return Math.max(1, Integer.parseInt(matcher.group(1)));
        }
        if (lower.matches(".*\\b(one|a|an)\\s+(?:seat|ticket)\\b.*")) return 1;
        if (lower.matches(".*\\btwo\\s+(?:seats|tickets)\\b.*")) return 2;
        if (lower.matches(".*\\bthree\\s+(?:seats|tickets)\\b.*")) return 3;
        if (lower.matches(".*\\bfour\\s+(?:seats|tickets)\\b.*")) return 4;
        return null;
    }

    private Optional<Long> parseSelectedBusId(String query) {
        Matcher matcher = Pattern.compile("(?i)\\bbus\\s*(?:id)?\\s*#?\\s*(\\d+)\\b").matcher(query == null ? "" : query);
        if (matcher.find()) {
            return Optional.of(Long.parseLong(matcher.group(1)));
        }
        return Optional.empty();
    }

    private boolean isExplicitBookingConfirmation(String lower) {
        return lower.contains("confirm")
                || lower.contains("go ahead")
                || lower.contains("book now")
                || lower.contains("reserve now")
                || lower.contains("yes book")
                || lower.contains("yes reserve");
    }

    private record ParsedBookingRequest(
            List<String> seatNumbers,
            Integer seatCount,
            Long busId,
            String busNumber,
            String busCategory,
            boolean confirmed) {}

    /**
     * Answers an administrator's question about operations.
     *
     * The question is read by the model, which names the report wanted and pulls out
     * the window, filters, bus and complaint id it mentions. Anything the model
     * cannot place, or that is genuinely a general question, falls through to the
     * conversational path with the operations summary supplied as context, so the
     * assistant answers from real figures instead of telling an admin to go and look
     * at the dashboard they are already inside.
     */
    private String handleAdminQuery(String userQuery, String chatId) {
        AdminAsk ask = understandAdminAsk(userQuery, chatId);
        try {
            return switch (ask.report()) {
                case "GREETING" -> adminOpsAgentService.greeting();
                case "OPS_SUMMARY" -> adminOpsAgentService.opsSummary();
                case "COMPLAINT_STATS" -> adminOpsAgentService.complaintInsights(
                        ask.days(),
                        AdminOpsAgentService.normalizeStatus(ask.status()),
                        AdminOpsAgentService.normalizePriority(ask.priority()),
                        AdminOpsAgentService.normalizeType(ask.complaintType()));
                case "COMPLAINT_LIST" -> adminOpsAgentService.openComplaints(
                        AdminOpsAgentService.normalizePriority(ask.priority()), 8);
                case "WATCHLIST" -> adminOpsAgentService.watchlist(ask.days(), ask.watchTarget());
                case "REVENUE" -> adminOpsAgentService.revenue(ask.days());
                case "BUS_PERFORMANCE" -> ask.busNumber() == null
                        ? "Which bus? Give me its number, for example NB-0012."
                        : adminOpsAgentService.busPerformance(ask.busNumber(), ask.days());
                case "RESOLVE_COMPLAINT" -> adminOpsAgentService.resolveComplaint(
                        ask.complaintId(), ask.adminResponse());
                default -> adminGeneralAnswer(userQuery, chatId);
            };
        } catch (RuntimeException ex) {
            log.warn("Admin operations agent failed for '{}': {}", ask.report(), ex.getMessage());
            return "I could not pull that from the database just now: %s".formatted(ex.getMessage());
        }
    }

    /** An admin question the model has read: which report, over what, filtered how. */
    private record AdminAsk(
            String report,
            Integer days,
            String status,
            String priority,
            String complaintType,
            String busNumber,
            String watchTarget,
            Long complaintId,
            String adminResponse) {}

    private AdminAsk understandAdminAsk(String userQuery, String chatId) {
        String instruction = """
                An administrator of a Sri Lankan bus company asked the question below.
                Decide which report answers it and pull out any details it mentions.
                Reply with a JSON object only, no prose, no code fences.

                Keys:
                  "report": exactly one of
                     GREETING          - a greeting, thanks, or asking what you can do. No data wanted.
                     OPS_SUMMARY       - a general "how are things" overview
                     COMPLAINT_STATS   - how many complaints, counts, breakdowns
                     COMPLAINT_LIST    - show me the actual open complaints to work through
                     WATCHLIST         - which buses or drivers attract the most complaints
                     REVENUE           - money taken, bookings, growth, comparisons between periods
                     BUS_PERFORMANCE   - how one named bus is doing
                     RESOLVE_COMPLAINT - close a complaint with a response
                     GENERAL           - anything else
                  "days": the window in days as a number, else null. "this week" is 7,
                      "last month" is 30, "this year" is 365.
                  "status": pending, under_review, resolved or rejected if named, else null.
                  "priority": low, medium or high if named, else null.
                  "complaintType": driver_behavior, bus_condition, route_issue, late_arrival,
                      payment_issue, booking_issue, safety_concern or other if named, else null.
                  "busNumber": a bus number such as NB-0012 if named, else null.
                  "watchTarget": "buses", "drivers", or "both" for WATCHLIST, else null.
                  "complaintId": the numeric id for RESOLVE_COMPLAINT, so COMP-0017 is 17, else null.
                  "adminResponse": for RESOLVE_COMPLAINT, what the admin wants recorded as the
                      response to the passenger, else null.

                Asking which driver or bus is worst is WATCHLIST, not COMPLAINT_STATS.
                Asking about money, growth or how a period compares to another is REVENUE.
                "Hi", "hello", "thanks", "what can you do" are GREETING: the admin is opening
                the conversation, not asking for figures. Do not return OPS_SUMMARY for those.

                Today is %s in Sri Lanka.

                %s
                Administrator question:
                %s
                """.formatted(
                        LocalDate.now(ZoneId.of("Asia/Colombo")),
                        memoryService.recentConversationDigest(chatId, 4),
                        userQuery.trim());

        try {
            String raw = callModelWithTimeout(() -> callModel(
                    "You classify admin operations questions and reply with JSON only.",
                    instruction,
                    primaryModelName,
                    0.0));
            JsonNode node = readJsonObject(raw);
            return new AdminAsk(
                    normalizeAdminReport(node.path("report").asText("")),
                    node.hasNonNull("days") && node.get("days").isNumber() ? node.get("days").asInt() : null,
                    blankToNull(node.path("status").asText("")),
                    blankToNull(node.path("priority").asText("")),
                    blankToNull(node.path("complaintType").asText("")),
                    blankToNull(node.path("busNumber").asText("")),
                    blankToNull(node.path("watchTarget").asText("")),
                    node.hasNonNull("complaintId") && node.get("complaintId").isNumber()
                            ? node.get("complaintId").asLong() : null,
                    blankToNull(node.path("adminResponse").asText("")));
        } catch (Exception ex) {
            log.warn("Admin question classification failed, using the overview: {}", ex.getMessage());
            return new AdminAsk("OPS_SUMMARY", null, null, null, null, null, null, null, null);
        }
    }

    private String normalizeAdminReport(String value) {
        if (value == null) {
            return "GENERAL";
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "GREETING", "OPS_SUMMARY", "COMPLAINT_STATS", "COMPLAINT_LIST", "WATCHLIST",
                 "REVENUE", "BUS_PERFORMANCE", "RESOLVE_COMPLAINT", "GENERAL" -> normalized;
            // An unrecognised label means the question did not match a report, which is
            // what GENERAL is for. Defaulting to the overview answered unrelated
            // questions with a wall of statistics.
            default -> "GENERAL";
        };
    }

    /**
     * Answers an off-report admin question conversationally, with the current
     * operations figures attached so the reply is grounded in real numbers.
     */
    private String adminGeneralAnswer(String userQuery, String chatId) {
        String prompt = """
                You are TrackNGo's operations assistant, talking to a signed-in administrator
                of a Sri Lankan bus company.

                Answer the question that was actually asked, in two or three sentences. Quote a
                figure only when it answers the question; do not recite the reference data
                below, and do not append a summary the administrator did not ask for.

                If the answer is not in the data, say so in one line and name what you would
                need, or point to the report that would have it. Never invent a number.

                These are the only reports you can offer, so never name any other:
                  the operations summary; complaint figures; the list of open complaints;
                  the watchlist of buses and drivers with the most complaints; revenue for a
                  period; and how one named bus is performing. You can also resolve a complaint.
                Suggest one only when it would actually answer the question. If none of them
                would, say the data is not held rather than inventing a report that might have it.

                Reference data, for your use only:
                %s

                %s
                Administrator question:
                %s
                """.formatted(
                        adminOpsAgentService.opsSummary(),
                        memoryService.recentConversationDigest(chatId, 4),
                        userQuery.trim());
        try {
            return callModelWithTimeout(() -> callModel(
                    "You are TrackNGo's admin operations assistant. You are concise and warm, "
                    + "you answer the question asked and nothing more, and you never invent figures.",
                    prompt,
                    primaryModelName,
                    0.3));
        } catch (Exception ex) {
            log.warn("Admin general answer failed: {}", ex.getMessage());
            // Falling back to the full overview answered an unrelated question with a
            // page of statistics. Say what happened and name what can still be asked.
            return "I could not work that one out just now. I can still give you the operations "
                    + "summary, complaint figures, the watchlist, revenue, or how a particular bus "
                    + "is doing.";
        }
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

    /** The bus the passenger named, preferring the model's reading over the regex. */
    private Optional<String> resolveBusReference(String userQuery, Understanding understanding) {
        return parseBusReference(userQuery)
                .or(() -> Optional.ofNullable(understanding == null ? null : understanding.busReference()));
    }

    /**
     * The delay line is printed only when there is a delay to report. It used to be
     * unconditional, so an answer that knew of no delay still ended with "Delay
     * estimate: 0 minutes", and the location line repeated whatever the message had
     * already said.
     */
    private String formatEtaResponse(TrafficEtaAgent.EtaResponse response) {
        StringBuilder reply = new StringBuilder(response.message());
        if (response.estimatedDelayMinutes() > 0) {
            reply.append("\nDelay estimate: ").append(response.estimatedDelayMinutes()).append(" minutes");
        }
        String location = response.currentLocation();
        if (location != null && !location.isBlank() && !response.message().contains(location)) {
            reply.append("\nLocation: ").append(location);
        }
        return reply.toString();
    }

    private String handleComplaintIntent(String userQuery, ExtractedComplaint alreadyExtracted) {
        ComplaintAnalysisResponse analysis = complaintAgentService.analyzeComplaint(
                new ComplaintAnalysisRequest(userQuery, currentUserId(), "mobile"));

        // Classification already read the message and pulled the details out; only
        // the multi-turn path, which never went through it, needs its own extraction.
        ExtractedComplaint extracted = alreadyExtracted != null
                ? alreadyExtracted
                : extractComplaint(userQuery);

        // The regex is the more reliable reader of a reference, since it matches the
        // exact issued format; the model fills in only when no reference was typed
        // in a recognisable shape.
        Optional<String> bookingReference = parseBookingReference(userQuery)
                .or(() -> Optional.ofNullable(extracted.bookingReference()).filter(ref -> !ref.isBlank()));

        AgentExecutionContext.Context context = AgentExecutionContext.get();

        if (context == null || context.email() == null || context.email().isBlank()) {
            return "I can help submit this complaint, but please sign in first so I can attach it to your passenger account.";
        }

        String description = extracted.description() == null ? "" : extracted.description().trim();
        if (description.isEmpty()) {
            return bookingReference
                    .map(ref -> "I have the booking reference **%s**. What went wrong on that trip? Describe the problem and I will file it.".formatted(ref))
                    .orElse(COMPLAINT_REFERENCE_PROMPT);
        }
        if (bookingReference.isEmpty()) {
            return """
                    I have this complaint ready to file:

                    > %s

                    Which trip was it about? Send me the booking reference, for example BK-20250501-ABCD, and I will submit it."""
                    .formatted(description);
        }

        boolean urgentSafetyEscalation = isUrgentSafetyComplaint(userQuery, analysis);

        // What the passenger explicitly asked for wins over what triage inferred:
        // saying "priority high" is a request, not a hint.
        String complaintType = firstNonBlank(
                urgentSafetyEscalation ? "safety_concern" : null,
                normalizeComplaintType(extracted.complaintType()),
                toManualComplaintType(analysis.category()));
        String priority = firstNonBlank(
                urgentSafetyEscalation ? "high" : null,
                normalizePriority(extracted.priority()),
                toManualPriority(analysis.priority()));

        ComplaintDto request = new ComplaintDto();
        request.setBookingReference(bookingReference.get());
        request.setComplaintType(complaintType);
        request.setPriority(priority);
        request.setDescription(buildComplaintDescription(description, analysis, urgentSafetyEscalation));

        try {
            ComplaintDto created = complaintSubmissionService.create(context.email(), request);
            if (urgentSafetyEscalation) {
                created.setStatus("under_review");
                created = complaintSubmissionService.update(created.getId(), created);
            }
            String status = urgentSafetyEscalation ? "Under Review" : "Pending";
            String escalation = urgentSafetyEscalation
                    ? "\n**Escalation:** Safety issue flagged for urgent admin review."
                    : "";
            return """
                    **Complaint submitted to admin.**
                    - **Complaint ID:** COMP-%04d
                    - **Category:** %s
                    - **Priority:** %s
                    - **Status:** %s%s

                    Admin can now review it from the complaints dashboard.
                    """.formatted(
                    created.getId(),
                    readableComplaintType(created.getComplaintType()),
                    readablePriority(created.getPriority()),
                    status,
                    escalation).trim();
        } catch (RuntimeException ex) {
            return "I could not submit the complaint yet: %s. Please check the booking reference and make sure it belongs to a past trip, then send the complaint again.".formatted(ex.getMessage());
        }
    }

    /** The parts of a complaint, pulled out of whatever the passenger happened to write. */
    private record ExtractedComplaint(
            String description,
            String bookingReference,
            String complaintType,
            String priority) {

        static ExtractedComplaint empty() {
            return new ExtractedComplaint(null, null, null, null);
        }
    }

    /** The journey a passenger described, however they phrased it. */
    private record ExtractedJourney(
            String origin,
            String destination,
            String date,
            String timeOfDay,
            String busCategory) {

        boolean hasRoute() {
            return origin != null && !origin.isBlank() && destination != null && !destination.isBlank();
        }
    }

    /** What the passenger wants, plus whatever details were found while working it out. */
    private record Understanding(
            String intent,
            ExtractedComplaint complaint,
            ExtractedJourney journey,
            String busReference) {}

    /**
     * Works out what the passenger is asking for, using the model rather than
     * keywords.
     *
     * Keyword matching decided intent from isolated words, and the failures were not
     * edge cases: "the AC was not working on my trip, booking BK-1234" is plainly a
     * complaint, but carries no complaint keyword and does carry "booking", so it
     * was routed to the booking agent. Adding more keywords only moves the boundary;
     * the model reads the sentence instead.
     *
     * Complaint details are extracted in the same call rather than a second one, so
     * understanding a message costs one round trip. Recent conversation is included
     * so a reply that only supplies a missing detail is read as continuing the
     * previous request.
     *
     * Falls back to the keyword classifier whenever the model is unreachable or
     * returns something unusable, so the assistant degrades to its previous
     * behaviour rather than failing.
     */
    private Understanding understand(String userQuery, String chatId) {
        String instruction = """
                Classify what this passenger of a Sri Lankan bus service wants, and extract
                any complaint details. Reply with a JSON object only, no prose, no code fences.

                Keys:
                  "intent": exactly one of
                     TRIP_PLANNING   - looking for buses, routes, times or fares for a journey
                     BOOKING         - wants to reserve seats, or is confirming a reservation
                     ETA             - asking where a bus is, or why it is late
                     COMPLAINT       - reporting a problem with a trip that already happened
                     RECOMMENDATION  - asking what route or trip to take
                     NOTIFICATION    - asking to be alerted or reminded about something
                     GENERAL         - anything else, including questions about policies,
                                       refunds, rules, or how the service works
                  "complaint": present only when intent is COMPLAINT, otherwise null. An object with:
                     "description"       - the grievance in the passenger's own words, as a clean
                                           statement of what went wrong. Exclude phrases asking to
                                           file a complaint, the booking reference, and any stated
                                           priority. Empty string if no grievance is described.
                     "bookingReference"  - the booking reference if one appears, else "".
                     "complaintType"     - one of driver_behavior, bus_condition, route_issue,
                                           late_arrival, payment_issue, booking_issue,
                                           safety_concern, other.
                     "priority"          - low, medium or high. Use what the passenger asked for
                                           if they stated one, otherwise judge from severity.
                  "journey": present when the message describes a journey, otherwise null. An object with:
                     "origin"      - where they are travelling from, as a place name, else "".
                     "destination" - where they are travelling to, else "".
                     "date"        - "today", "tomorrow", or an exact date as YYYY-MM-DD. Resolve
                                     relative wording such as "this Friday" against today's date.
                                     Empty string if no date was given.
                     "timeOfDay"   - morning, afternoon, evening or night if stated, else "".
                     "busCategory" - highway, long_distance, luxury or semi_luxury if stated, else "".
                  "busReference": a bus number such as NB-0012 if the message names one, else "".

                Asking what the refund or cancellation rules are is GENERAL, not COMPLAINT.
                Reporting that a past trip went wrong is COMPLAINT even if the word
                "complaint" never appears.
                Read the journey whatever the word order: "to Kandy from Colombo" and "Colombo
                to Kandy" describe the same trip. If only a destination is given, leave origin
                empty rather than guessing one.

                Today is %s in Sri Lanka.

                %s
                Passenger message:
                %s
                """.formatted(
                        LocalDate.now(ZoneId.of("Asia/Colombo")),
                        memoryService.recentConversationDigest(chatId, 4),
                        userQuery.trim());

        try {
            String raw = callModelWithTimeout(() -> callModel(
                    "You classify intent and extract structured data. You reply with JSON only.",
                    instruction,
                    primaryModelName,
                    0.0));
            JsonNode node = readJsonObject(raw);
            String intent = normalizeIntent(node.path("intent").asText(""));
            if (intent == null) {
                return keywordUnderstanding(userQuery);
            }
            ExtractedComplaint complaint = node.hasNonNull("complaint") && node.get("complaint").isObject()
                    ? toExtractedComplaint(node.get("complaint"))
                    : null;
            ExtractedJourney journey = node.hasNonNull("journey") && node.get("journey").isObject()
                    ? toExtractedJourney(node.get("journey"))
                    : null;
            String busReference = node.path("busReference").asText("");
            return new Understanding(intent, complaint, journey, blankToNull(busReference));
        } catch (Exception ex) {
            log.warn("Intent classification failed, falling back to keywords: {}", ex.getMessage());
            return keywordUnderstanding(userQuery);
        }
    }

    /** The pre-model behaviour, used whenever the model cannot be reached. */
    private Understanding keywordUnderstanding(String userQuery) {
        return new Understanding(detectIntent(userQuery), null, null, null);
    }

    private ExtractedJourney toExtractedJourney(JsonNode node) {
        return new ExtractedJourney(
                blankToNull(node.path("origin").asText("")),
                blankToNull(node.path("destination").asText("")),
                blankToNull(node.path("date").asText("")),
                blankToNull(node.path("timeOfDay").asText("")),
                blankToNull(node.path("busCategory").asText("")));
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    /**
     * The journey to act on, preferring what the model read from the sentence.
     *
     * The regex only matches a literal "from X to Y", so "I need to go to Kandy from
     * Colombo Fort" and "show me buses to Galle" matched nothing and fell through to
     * a generic model answer instead of a real timetable lookup. It is kept as the
     * fallback for when the model is unavailable.
     */
    private Optional<TripPlanningAgent.RouteRequest> resolveRouteRequest(String userQuery, Understanding understanding) {
        ExtractedJourney journey = understanding == null ? null : understanding.journey();
        if (journey != null && journey.hasRoute()) {
            return Optional.of(new TripPlanningAgent.RouteRequest(
                    resolveStopName(journey.origin()),
                    resolveStopName(journey.destination()),
                    journey.date() == null ? "today" : journey.date(),
                    journey.busCategory() != null ? journey.busCategory() : parseBusCategory(userQuery),
                    journey.timeOfDay()));
        }
        return parseRouteRequest(userQuery);
    }

    /** Keeps only intents the router has a branch for. */
    private String normalizeIntent(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "TRIP_PLANNING", "BOOKING", "ETA", "COMPLAINT",
                 "RECOMMENDATION", "NOTIFICATION", "GENERAL" -> normalized;
            default -> null;
        };
    }

    private ExtractedComplaint toExtractedComplaint(JsonNode node) {
        return new ExtractedComplaint(
                node.path("description").asText(""),
                node.path("bookingReference").asText(""),
                node.path("complaintType").asText(""),
                node.path("priority").asText(""));
    }

    /**
     * Pulls the JSON object out of a model reply. Models wrap JSON in prose or code
     * fences despite instructions, so the object is located by its outermost braces.
     */
    private JsonNode readJsonObject(String raw) throws JsonProcessingException {
        if (raw == null || raw.isBlank()) {
            throw new IllegalStateException("Model returned an empty response");
        }
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) {
            throw new IllegalStateException("Model response contained no JSON object");
        }
        return objectMapper.readTree(raw.substring(start, end + 1));
    }

    /**
     * Separates the actual grievance from the instructions wrapped around it.
     *
     * A passenger writes one sentence that mixes several things: "I want to submit a
     * complaint, my booking ID is BK-1234, the driver was drunk, priority high".
     * Storing that verbatim gave admin a record whose description repeated the
     * booking reference and the word "priority" instead of just saying what
     * happened. The model is asked to return the complaint itself, with the request
     * wording, the reference, and the stated priority lifted into their own fields —
     * which is also how a passenger naming a priority gets that priority, rather
     * than whatever triage guessed.
     *
     * Falls back to the passenger's raw words if the model is unreachable or answers
     * with something unparseable, so a complaint is never lost to an extraction
     * failure.
     */
    private ExtractedComplaint extractComplaint(String userQuery) {
        if (userQuery == null || userQuery.isBlank()) {
            return ExtractedComplaint.empty();
        }

        String instruction = """
                Extract the complaint from this passenger message for a Sri Lankan bus service.

                Return only a JSON object, no prose and no code fences, with these keys:
                  "description": the complaint itself in the passenger's own words, as a clean
                      statement of what went wrong. Exclude phrases asking to file a complaint,
                      the booking reference, and any stated priority. Empty string if the
                      message contains no actual grievance.
                  "bookingReference": the booking reference if one appears, else "".
                  "complaintType": one of driver_behavior, bus_condition, route_issue,
                      late_arrival, payment_issue, booking_issue, safety_concern, other.
                  "priority": low, medium or high. Use what the passenger asked for if they
                      stated one, otherwise judge it from severity.

                Passenger message:
                %s
                """.formatted(userQuery.trim());

        try {
            String raw = callModelWithTimeout(() -> callModel(
                    "You extract structured data and reply with JSON only.",
                    instruction,
                    primaryModelName,
                    0.0));
            return parseExtractedComplaint(raw);
        } catch (Exception ex) {
            log.warn("Complaint extraction failed, using the raw message: {}", ex.getMessage());
            return new ExtractedComplaint(userQuery.trim(), null, null, null);
        }
    }

    private ExtractedComplaint parseExtractedComplaint(String raw) {
        try {
            return toExtractedComplaint(readJsonObject(raw));
        } catch (Exception ex) {
            log.warn("Could not parse extracted complaint JSON: {}", ex.getMessage());
            return ExtractedComplaint.empty();
        }
    }

    /** Keeps only values the complaint_type column accepts. */
    private String normalizeComplaintType(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "driver_behavior", "bus_condition", "route_issue", "late_arrival",
                 "payment_issue", "booking_issue", "safety_concern", "other" -> normalized;
            default -> null;
        };
    }

    /** Keeps only values the priority column accepts. */
    private String normalizePriority(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "low", "medium", "high" -> normalized;
            case "urgent", "critical" -> "high";
            default -> null;
        };
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return "other";
    }

    private String formatRecommendationResponse(RecommendationResponse response) {
        String notification = response.notificationId() == null
                ? ""
                : "\n\nI also sent these recommendations to your TrackNGo notification inbox (ID: %d).".formatted(response.notificationId());
        return "Recommendations:\n- %s\n\nReasoning: %s%s".formatted(
                String.join("\n- ", response.recommendations()),
                response.reasoning(),
                notification);
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
        return callModel(
                "You are TrackNGo AI, a concise Sri Lankan bus travel assistant. "
                + "You answer questions but cannot perform actions: you cannot book, cancel, refund, "
                + "or submit complaints. Never claim such an action has been done or is in progress, "
                + "and never invent a reference number.",
                enrichedPrompt,
                modelName,
                0.3);
    }

    /**
     * One chat completion against the configured OpenAI-compatible provider.
     *
     * Kept separate from the conversational path so extraction work can use its own
     * system prompt and a lower temperature, where the answer has to be machine
     * readable rather than friendly.
     */
    private String callModel(String systemMessage, String userPrompt, String modelName, double temperature) {
        if (modelApiKey == null || modelApiKey.isBlank()) {
            throw new IllegalStateException("AI API key is not configured");
        }
        if (modelBaseUrl == null || modelBaseUrl.isBlank()) {
            throw new IllegalStateException("AI base URL is not configured");
        }

        Map<String, Object> requestBody = Map.of(
                "model", modelName,
                "messages", List.of(
                        Map.of("role", "system", "content", systemMessage),
                        Map.of("role", "user", "content", userPrompt)
                ),
                "temperature", temperature
        );

        DirectChatResponse response;
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(chatCompletionsUrl()))
                    .timeout(Duration.ofSeconds(Math.max(1, modelTimeoutSeconds)))
                    .header("Authorization", "Bearer " + modelApiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(requestBody)))
                    .build();
            HttpResponse<String> httpResponse = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (httpResponse.statusCode() < 200 || httpResponse.statusCode() >= 300) {
                throw new IllegalStateException("AI provider returned HTTP " + httpResponse.statusCode());
            }
            response = objectMapper.readValue(httpResponse.body(), DirectChatResponse.class);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("AI provider request was interrupted", e);
        } catch (Exception e) {
            throw new IllegalStateException("AI provider request failed", e);
        }

        if (response == null || response.choices() == null || response.choices().isEmpty()
                || response.choices().get(0).message() == null
                || response.choices().get(0).message().content() == null
                || response.choices().get(0).message().content().isBlank()) {
            throw new IllegalStateException("AI provider returned an empty response");
        }
        return response.choices().get(0).message().content().trim();
    }

    private boolean sameModelName(String first, String second) {
        return first != null && second != null && first.equalsIgnoreCase(second);
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
        Pattern pattern = Pattern.compile("(?i)\\bfrom\\s+(.+?)\\s+to\\s+(.+?)(?:\\s+(?:on\\s+)?(today|tomorrow|\\d{4}-\\d{2}-\\d{2}|morning|afternoon|evening|night)\\b|$)");
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
        return Optional.of(new TripPlanningAgent.RouteRequest(
                resolveStopName(source), resolveStopName(destination), date, parseBusCategory(query), preferredTime));
    }

    /**
     * Maps what a passenger typed onto a stop name the booking search will actually
     * match.
     *
     * Bus search compares stop names for equality after stripping spaces and
     * hyphens, so a passenger asking for "Colombo" finds nothing even though
     * "Colombo Fort" is on the route: people name cities, while the timetable names
     * stops. Matching is tried from most to least precise — exact, then stop names
     * that begin with what was typed, then names that contain it — and the shortest
     * candidate wins so "Colombo" resolves to "Colombo Fort" rather than a longer
     * stop that merely mentions it.
     *
     * The original text is returned unchanged when nothing matches, which leaves the
     * caller free to report "no buses found" with the words the passenger used.
     */
    private String resolveStopName(String rawName) {
        String normalized = normalizeStopKey(rawName);
        if (normalized.isBlank()) {
            return rawName;
        }
        try {
            List<String> matches = jdbcTemplate.query("""
                    SELECT DISTINCT name
                    FROM route_stop
                    WHERE LOWER(REPLACE(REPLACE(TRIM(name), '-', ''), ' ', '')) = ?
                       OR LOWER(REPLACE(REPLACE(TRIM(name), '-', ''), ' ', '')) LIKE CONCAT(?, '%')
                       OR LOWER(REPLACE(REPLACE(TRIM(name), '-', ''), ' ', '')) LIKE CONCAT('%', ?, '%')
                    ORDER BY CHAR_LENGTH(name)
                    LIMIT 1
                    """,
                    (rs, rowNum) -> rs.getString("name"),
                    normalized, normalized, normalized);
            return matches.isEmpty() ? rawName : matches.get(0);
        } catch (DataAccessException ex) {
            log.warn("Stop name resolution failed for '{}': {}", rawName, ex.getMessage());
            return rawName;
        }
    }

    /** Same normalisation the booking search applies, so both sides agree on a match. */
    private String normalizeStopKey(String value) {
        if (value == null) {
            return "";
        }
        return value.trim().toLowerCase(Locale.ROOT).replace("-", "").replace(" ", "");
    }

    private String resolveTravelDate(String date) {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Colombo"));
        if (date == null || date.isBlank()) {
            return today.toString();
        }
        String normalized = date.trim().toLowerCase(Locale.ROOT);
        if ("today".equals(normalized)) {
            return today.toString();
        }
        if ("tomorrow".equals(normalized)) {
            return today.plusDays(1).toString();
        }
        return date.trim();
    }

    private String parseBusCategory(String query) {
        String lower = query == null ? "" : query.toLowerCase(Locale.ROOT);
        if (lower.contains("luxury")) {
            return "luxury";
        }
        if (lower.contains("semi")) {
            return "semi_luxury";
        }
        if (lower.contains("highway") || lower.contains("express")) {
            return "highway";
        }
        if (lower.contains("long distance")) {
            return "long_distance";
        }
        return null;
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
        return builder.toString().trim();
    }

    private Optional<String> parseBookingReference(String userQuery) {
        Matcher matcher = Pattern.compile("(?i)\\bBK-[A-Z0-9-]+\\b").matcher(userQuery == null ? "" : userQuery);
        if (matcher.find()) {
            return Optional.of(matcher.group().toUpperCase());
        }
        return Optional.empty();
    }

    private String toManualComplaintType(String category) {
        return switch (category) {
            case "SAFETY_INCIDENT" -> "safety_concern";
            case "SERVICE_DELAY" -> "late_arrival";
            case "PAYMENT_ISSUE" -> "payment_issue";
            case "DRIVER_BEHAVIOR" -> "driver_behavior";
            case "SERVICE_QUALITY" -> "route_issue";
            default -> "other";
        };
    }

    private String toManualPriority(String priority) {
        return switch (priority) {
            case "URGENT", "HIGH" -> "high";
            case "LOW" -> "low";
            default -> "medium";
        };
    }

    /**
     * Composes the complaint text stored against the booking, within the 500
     * character limit ComplaintServiceImpl enforces.
     *
     * The previous format spelled out every triage field over several labelled
     * lines and, added to the passenger's own words, reliably exceeded that limit —
     * so submitting a complaint through the assistant failed outright whenever a
     * booking reference was supplied. Triage is now one compact line, and the
     * passenger's message is what gets trimmed if anything still has to give, since
     * the category and priority are also stored in their own columns while the
     * passenger's account of what happened exists nowhere else.
     */
    private String buildComplaintDescription(String complaintText, ComplaintAnalysisResponse analysis, boolean urgentSafetyEscalation) {
        String triage = "\n\n[AI triage: %s / %s%s]".formatted(
                analysis.category(),
                urgentSafetyEscalation ? "HIGH — safety escalation" : analysis.priority(),
                urgentSafetyEscalation ? "" : " / " + analysis.routingTarget());

        String prefix = "Via TrackNGo AI: ";
        String message = complaintText == null ? "" : complaintText.trim();
        int roomForMessage = COMPLAINT_DESCRIPTION_LIMIT - prefix.length() - triage.length();
        if (message.length() > roomForMessage) {
            message = message.substring(0, Math.max(0, roomForMessage - 3)) + "...";
        }
        return prefix + message + triage;
    }

    private boolean isUrgentSafetyComplaint(String userQuery, ComplaintAnalysisResponse analysis) {
        String lower = userQuery == null ? "" : userQuery.toLowerCase(Locale.ROOT);
        return "SAFETY_INCIDENT".equalsIgnoreCase(analysis.category())
                || lower.contains("unsafe")
                || lower.contains("reckless")
                || lower.contains("harassment")
                || lower.contains("assault")
                || lower.contains("drunk")
                || lower.contains("brake")
                || lower.contains("accident")
                || lower.contains("overcrowded")
                || lower.contains("over crowded")
                || lower.contains("fire");
    }

    private String readableComplaintType(String complaintType) {
        return switch (complaintType) {
            case "driver_behavior" -> "Driver Behavior";
            case "bus_condition" -> "Bus Condition";
            case "route_issue" -> "Route Issue";
            case "late_arrival" -> "Late Arrival";
            case "payment_issue" -> "Payment Issue";
            case "booking_issue" -> "Booking Issue";
            case "safety_concern" -> "Safety Concern";
            default -> "Other";
        };
    }

    private String readablePriority(String priority) {
        if (priority == null || priority.isBlank()) {
            return "Medium";
        }
        return priority.substring(0, 1).toUpperCase(Locale.ROOT) + priority.substring(1).toLowerCase(Locale.ROOT);
    }

    private String buildPrompt(String userQuery, String chatId, String language) {
        AgentExecutionContext.Context context = AgentExecutionContext.get();
        String userContext = context == null || !context.hasUser()
                ? "No authenticated passenger context is available. Ask for passenger id before creating paid bookings."
                : "Authenticated user id %d, email %s, role %s. Prefer this passenger id for bookings unless the user says otherwise."
                    .formatted(context.userId(), context.email(), context.role());

        return """
                You are TrackNGo AI, a production travel assistant for a Sri Lankan bus booking platform.
                Respond entirely in %s. When the requested language is Sinhala or Tamil, use natural words and native script for that language; keep TrackNGo, route names, bus numbers, booking references, currency codes, and technical identifiers unchanged.
                Use Sri Lankan places, LKR fares, local operators, and practical transport wording.
                Prefer tool results and database facts over general model knowledge. If details are missing, ask the passenger for the exact missing information.

                You are answering in an informational capacity only. You cannot book seats, submit complaints, cancel trips, issue refunds, or send notifications yourself: those are carried out by TrackNGo's booking and complaint systems, not by you.
                Never state or imply that any such action has been taken, is being processed, or has been passed to a team. Never invent a booking reference, complaint id, confirmation number, or promised follow-up.
                When a passenger wants one of those actions, tell them what you need in order to proceed, or point them to the relevant screen, and stop there.
                Today is %s in Sri Lanka.

                User context:
                %s

                %s
                %s
                User request:
                %s
                """.formatted(
                "si".equals(language) ? "Sinhala" : "ta".equals(language) ? "Tamil" : "English",
                LocalDate.now(ZoneId.of("Asia/Colombo")),
                userContext,
                memoryService.recentConversationDigest(chatId, 8),
                groundingService.buildGroundingDigest(userQuery),
                userQuery);
    }

    private String deterministicFallback(String userQuery, String language) {
        if ("si".equals(language)) {
            return "AI සේවාවට මේ මොහොතේ සම්බන්ධ විය නොහැක. එහෙත් ඔබට ශ්‍රී ලංකාවේ මාර්ග සෙවීම, වෙන්කිරීම්, සජීවී පැමිණීමේ වේලාව, පැමිණිලි හෝ දැනුම්දීම් සම්බන්ධයෙන් සහාය ලබාගත හැකිය. කරුණාකර නැවත උත්සාහ කරන්න.";
        }
        if ("ta".equals(language)) {
            return "AI சேவையை இந்த நேரத்தில் அணுக முடியவில்லை. இருப்பினும் இலங்கையின் பாதை தேடல், முன்பதிவுகள், நேரடி வருகை நேரம், புகார்கள் அல்லது அறிவிப்புகள் தொடர்பாக உங்களுக்கு உதவ முடியும். மீண்டும் முயற்சிக்கவும்.";
        }
        String lower = userQuery.toLowerCase();
        if (isComplaintIntent(lower)) {
            return "I can help submit this complaint for admin review. Please include your past booking reference, for example BK-20250501-ABCD, and describe what happened.";
        }
        if (lower.contains("book") || lower.contains("seat")) {
            return "I could not reach the AI model, but booking is still available through the TrackNGo booking flow. Tell me the bus number, route, date, boarding stop, destination stop, and seat count so I can retry with the booking tool.";
        }
        if (lower.contains("route") || lower.contains("bus") || lower.contains("travel")) {
            return "I could not reach the AI model, but TrackNGo currently supports Sri Lankan route discovery such as Colombo Fort to Kandy, Galle, Matara, Jaffna, Negombo, and Kandy to Nuwara Eliya. Share your source, destination, date, and preferred time so I can retry the live search.";
        }
        return "I am having trouble reaching the AI model right now. I can still help with Sri Lankan route search, booking, live ETA, complaints, or notifications once the model connection recovers.";
    }

    private String normalizeLanguage(String language) {
        if ("si".equalsIgnoreCase(language)) return "si";
        if ("ta".equalsIgnoreCase(language)) return "ta";
        return "en";
    }

    private String detectIntent(String query) {
        String lower = query.toLowerCase();
        // A question about how the rules work is answered by the model from grounded
        // policy knowledge. Sending it to a tool produces a form to fill in instead
        // of an answer: "what is the refund policy if I cancel my booking" matches
        // the complaint keyword "refund" and the booking keyword "book", so it has
        // to be recognised as a question before any tool keyword is considered.
        if (isPolicyQuestion(lower)) {
            return "GENERAL";
        }
        if (isComplaintIntent(lower)) {
            return "COMPLAINT";
        }
        if (lower.contains("book") || lower.contains("seat") || lower.contains("reserve")) {
            return "BOOKING";
        }
        if (lower.contains("delay") || lower.contains("eta") || lower.contains("late") || lower.contains("traffic")) {
            return "ETA";
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


    private boolean isAdminContext() {
        AgentExecutionContext.Context context = AgentExecutionContext.get();
        return context != null && context.role() != null && context.role().equalsIgnoreCase("admin");
    }
    private boolean isComplaintIntent(String lower) {
        return lower.contains("complaint")
                || lower.contains("complain")
                || lower.contains("refund")
                || lower.contains("rude")
                || lower.contains("unsafe")
                || lower.contains("harassment")
                || lower.contains("reckless")
                || lower.contains("overcrowded")
                || lower.contains("over crowded");
    }

    /**
     * Whether the passenger is asking how something works rather than reporting that
     * it went wrong. Requires both a question opener and a policy-flavoured noun, so
     * "how do I get a refund" is informational while "I want a refund for this trip"
     * still reaches the complaint agent.
     */
    private boolean isPolicyQuestion(String lower) {
        // Naming a journey or a bus makes the question operational rather than
        // informational: "how much is the fare from Colombo Fort to Kandy" wants a
        // real search over today's buses, not the pricing rulebook.
        if (ROUTE_MENTION.matcher(lower).find() || BUS_MENTION.matcher(lower).find()) {
            return false;
        }
        boolean asksAQuestion = lower.startsWith("what")
                || lower.startsWith("how")
                || lower.startsWith("when")
                || lower.startsWith("can i")
                || lower.startsWith("do i")
                || lower.startsWith("is there")
                || lower.startsWith("explain")
                || lower.startsWith("tell me about");
        if (!asksAQuestion) {
            return false;
        }
        return lower.contains("policy")
                || lower.contains("policies")
                || lower.contains("rule")
                || lower.contains("charge")
                || lower.contains("fee")
                || lower.contains("percentage")
                || lower.contains("how much")
                || lower.contains("eligible")
                || lower.contains("entitled")
                || lower.contains("work");
    }

    private int elapsedMs(long startedAt) {
        return (int) ((System.nanoTime() - startedAt) / 1_000_000);
    }
}
