package com.trackngo.aiagent.orchestration;

import com.fasterxml.jackson.databind.ObjectMapper;
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
import com.trackngo.booking.api.dto.BookingFlowDtos;
import com.trackngo.booking.internal.service.BookingFlowService;
import com.trackngo.complaint.api.ComplaintService;
import com.trackngo.complaint.api.dto.ComplaintDto;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
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
    private final BookingFlowService bookingFlowService;
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
            BookingFlowService bookingFlowService,
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
        this.bookingFlowService = bookingFlowService;
        this.jdbcTemplate = jdbcTemplate;
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
            if (sameModelName(primaryModelName, fallbackModelName)) {
                String reply = deterministicFallback(userQuery);
                memoryService.recordMessage(chatId, "assistant", reply);
                memoryService.recordInteraction(chatId, detectedIntent, "FAILED_FALLBACK_USED", elapsedMs(startedAt), primaryModelName, e.getMessage());
                return reply;
            }
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

    public String fallbackReply(String userQuery) {
        return deterministicFallback(userQuery == null ? "" : userQuery);
    }

    private Optional<String> tryDeterministicToolPath(String userQuery, String chatId, String detectedIntent) {
        return switch (detectedIntent) {
            case "TRIP_PLANNING" -> parseRouteRequest(userQuery)
                    .map(tripPlanningAgentService::findRoutes)
                    .map(this::formatRouteResponse);
            case "BOOKING" -> Optional.of(handleBookingIntent(userQuery));
            case "ADMIN_OPS" -> Optional.of(handleAdminOpsIntent(userQuery));
            case "ETA" -> parseBusReference(userQuery)
                    .map(busId -> trafficEtaAgentService.getLiveEta(new TrafficEtaAgent.EtaRequest(busId)))
                    .map(this::formatEtaResponse);
            case "COMPLAINT" -> Optional.of(handleComplaintIntent(userQuery));
            case "RECOMMENDATION" -> Optional.of(formatRecommendationResponse(recommendationAgentService.generateRecommendations(
                    new RecommendationRequest(currentUserId(), userQuery, userQuery, List.of()))));
            default -> Optional.empty();
        };
    }

    private String handleBookingIntent(String userQuery) {
        ParsedBookingRequest booking = parseNaturalLanguageBooking(userQuery);
        Optional<TripPlanningAgent.RouteRequest> routeRequest = parseRouteRequest(userQuery);

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

        BookingFlowDtos.CreateBookingRequest request = new BookingFlowDtos.CreateBookingRequest(
                bus.busId(),
                travelDate,
                bus.startTime(),
                booking.seatNumbers(),
                "Created through TrackNGo AI natural-language booking.",
                "stripe",
                totalAmount,
                context.userId(),
                route.source(),
                route.destination(),
                totalAmount,
                BigDecimal.ZERO,
                null,
                null
        );

        try {
            BookingFlowDtos.BookingConfirmationResult created = bookingFlowService.createBooking(request);
            return """
                    **Booking confirmed.**
                    - **Reference:** %s
                    - **Bus:** %s
                    - **Route:** %s to %s
                    - **Date/time:** %s at %s
                    - **Seats:** %s
                    - **Total:** LKR %s
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

    private String handleAdminOpsIntent(String userQuery) {
        AgentExecutionContext.Context context = AgentExecutionContext.get();
        if (context == null || context.role() == null || !context.role().equalsIgnoreCase("admin")) {
            return "The admin operations co-pilot is only available to signed-in admins. Passenger AI can still help with bookings, ETA, refunds, and complaints.";
        }

        try {
            long totalComplaints = countLong("SELECT COUNT(*) FROM complaint");
            long pendingComplaints = countLong("SELECT COUNT(*) FROM complaint WHERE status = 'pending'");
            long underReviewComplaints = countLong("SELECT COUNT(*) FROM complaint WHERE status = 'under_review'");
            long highPriorityComplaints = countLong("SELECT COUNT(*) FROM complaint WHERE priority = 'high' AND status IN ('pending', 'under_review')");
            long safetyComplaints7Days = countLong("SELECT COUNT(*) FROM complaint WHERE complaint_type = 'safety_concern' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)");
            long bookingsToday = countLong("SELECT COUNT(*) FROM seat_booking WHERE journey_date = CURDATE() AND status <> 'cancelled'");
            BigDecimal revenueToday = sumMoney("SELECT COALESCE(SUM(total_amount), 0) FROM seat_booking WHERE journey_date = CURDATE() AND status <> 'cancelled'");

            List<Map<String, Object>> topBuses = jdbcTemplate.queryForList("""
                    SELECT COALESCE(b.bus_number, '--') AS label, COUNT(*) AS total
                    FROM complaint c
                    LEFT JOIN seat_booking sb ON sb.booking_reference = c.booking_reference
                    LEFT JOIN bus b ON b.bus_id = sb.bus_id
                    WHERE c.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                    GROUP BY COALESCE(b.bus_number, '--')
                    ORDER BY total DESC
                    LIMIT 3
                    """);

            List<Map<String, Object>> topDrivers = jdbcTemplate.queryForList("""
                    SELECT TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS label, COUNT(*) AS total
                    FROM complaint c
                    LEFT JOIN seat_booking sb ON sb.booking_reference = c.booking_reference
                    LEFT JOIN bus b ON b.bus_id = sb.bus_id
                    LEFT JOIN driver d ON d.driver_id = b.driver_id
                    LEFT JOIN `user` u ON u.user_id = d.driver_id
                    WHERE c.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                    GROUP BY TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')))
                    ORDER BY total DESC
                    LIMIT 3
                    """);

            return """
                    **Admin operations summary**
                    - **Total complaints:** %d
                    - **Open complaints:** %d pending, %d under review
                    - **High priority open issues:** %d
                    - **Safety complaints in last 7 days:** %d
                    - **Bookings today:** %d
                    - **Today revenue:** LKR %s

                    **Watchlist**
                    %s
                    %s

                    **Recommended actions**
                    1. Review high-priority and safety complaints first.
                    2. Contact operators for buses appearing repeatedly in the watchlist.
                    3. Close resolved complaints with a clear admin response so passengers can see progress.
                    """.formatted(
                    totalComplaints,
                    pendingComplaints,
                    underReviewComplaints,
                    highPriorityComplaints,
                    safetyComplaints7Days,
                    bookingsToday,
                    revenueToday.setScale(2, java.math.RoundingMode.HALF_UP),
                    formatTopRows("Top complaint buses", topBuses),
                    formatTopRows("Top complaint drivers", topDrivers)).trim();
        } catch (RuntimeException ex) {
            log.warn("Admin operations co-pilot failed: {}", ex.getMessage());
            return "I could not build the admin operations summary right now. Please check that the complaint and booking tables are available, then try again.";
        }
    }

    private long countLong(String sql) {
        Long value = jdbcTemplate.queryForObject(sql, Long.class);
        return value == null ? 0L : value;
    }

    private BigDecimal sumMoney(String sql) {
        BigDecimal value = jdbcTemplate.queryForObject(sql, BigDecimal.class);
        return value == null ? BigDecimal.ZERO : value;
    }

    private String formatTopRows(String title, List<Map<String, Object>> rows) {
        if (rows == null || rows.isEmpty()) {
            return "- **%s:** No data yet".formatted(title);
        }
        StringBuilder builder = new StringBuilder("- **").append(title).append(":** ");
        for (int i = 0; i < rows.size(); i++) {
            Map<String, Object> row = rows.get(i);
            String label = String.valueOf(row.get("label"));
            if (label == null || label.isBlank() || "null".equalsIgnoreCase(label)) {
                label = "Unassigned";
            }
            Object total = row.get("total");
            builder.append(label).append(" (").append(total).append(")");
            if (i < rows.size() - 1) {
                builder.append(", ");
            }
        }
        return builder.toString();
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
        return "%s\nDelay estimate: %d minutes\nLocation: %s".formatted(
                response.message(),
                response.estimatedDelayMinutes(),
                response.currentLocation());
    }

    private String handleComplaintIntent(String userQuery) {
        ComplaintAnalysisResponse analysis = complaintAgentService.analyzeComplaint(
                new ComplaintAnalysisRequest(userQuery, currentUserId(), "mobile"));
        Optional<String> bookingReference = parseBookingReference(userQuery);
        AgentExecutionContext.Context context = AgentExecutionContext.get();

        if (context == null || context.email() == null || context.email().isBlank()) {
            return "I can help submit this complaint, but please sign in first so I can attach it to your passenger account.";
        }
        if (bookingReference.isEmpty()) {
            return "I can submit this complaint for admin review. Please send the booking reference for the past trip, for example BK-20250501-ABCD, and include any extra details you want admin to see.";
        }

        boolean urgentSafetyEscalation = isUrgentSafetyComplaint(userQuery, analysis);
        String complaintType = urgentSafetyEscalation ? "safety_concern" : toManualComplaintType(analysis.category());
        String priority = urgentSafetyEscalation ? "high" : toManualPriority(analysis.priority());

        ComplaintDto request = new ComplaintDto();
        request.setBookingReference(bookingReference.get());
        request.setComplaintType(complaintType);
        request.setPriority(priority);
        request.setDescription(buildComplaintDescription(userQuery, analysis, urgentSafetyEscalation));

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

    private String formatRecommendationResponse(RecommendationResponse response) {
        return "Recommendations:\n- %s\n\nReasoning: %s".formatted(
                String.join("\n- ", response.recommendations()),
                response.reasoning());
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

        Map<String, Object> requestBody = Map.of(
                "model", modelName,
                "messages", List.of(
                        Map.of("role", "system", "content", "You are TrackNGo AI, a concise Sri Lankan bus travel assistant."),
                        Map.of("role", "user", "content", enrichedPrompt)
                ),
                "temperature", 0.3
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
        return Optional.of(new TripPlanningAgent.RouteRequest(source, destination, date, parseBusCategory(query), preferredTime));
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

    private String buildComplaintDescription(String userQuery, ComplaintAnalysisResponse analysis, boolean urgentSafetyEscalation) {
        return "Submitted through TrackNGo AI.\n\nPassenger message: %s\n\nAI triage:\n- Category: %s\n- Priority: %s\n- Routing target: %s\n- Summary: %s\n- Suggested admin action: %s%s".formatted(
                userQuery.trim(),
                analysis.category(),
                urgentSafetyEscalation ? "HIGH" : analysis.priority(),
                urgentSafetyEscalation ? "SAFETY_ESCALATION" : analysis.routingTarget(),
                analysis.summary(),
                analysis.suggestedAction(),
                urgentSafetyEscalation ? "\n- Escalation note: Passenger message contains safety-critical language and was automatically moved to under review." : "");
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

    private String buildPrompt(String userQuery, String chatId) {
        AgentExecutionContext.Context context = AgentExecutionContext.get();
        String userContext = context == null || !context.hasUser()
                ? "No authenticated passenger context is available. Ask for passenger id before creating paid bookings."
                : "Authenticated user id %d, email %s, role %s. Prefer this passenger id for bookings unless the user says otherwise."
                    .formatted(context.userId(), context.email(), context.role());

        return """
                You are TrackNGo AI, a production travel assistant for a Sri Lankan bus booking platform.
                Use Sri Lankan places, LKR fares, local operators, and practical transport wording.
                Prefer tool results and database facts over general model knowledge. If details are missing, ask the passenger for the exact missing information.
                For bookings, never invent a confirmation number; use reserveSeat and report its exact result.
                For delays, combine getLiveEta with route alternatives where useful.
                When multiple agents/tools contribute, summarize their contributions in concise labels.
                Today is %s in Sri Lanka.

                User context:
                %s

                %s
                %s
                User request:
                %s
                """.formatted(
                LocalDate.now(ZoneId.of("Asia/Colombo")),
                userContext,
                memoryService.recentConversationDigest(chatId, 8),
                groundingService.buildGroundingDigest(userQuery),
                userQuery);
    }

    private String deterministicFallback(String userQuery) {
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

    private String detectIntent(String query) {
        String lower = query.toLowerCase();
        if (isAdminOpsIntent(lower)) {
            return "ADMIN_OPS";
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

    private boolean isAdminOpsIntent(String lower) {
        return lower.contains("admin summary")
                || lower.contains("admin dashboard")
                || lower.contains("operations summary")
                || lower.contains("ops summary")
                || lower.contains("operations report")
                || lower.contains("dashboard summary")
                || lower.contains("complaints this week")
                || lower.contains("unresolved complaints")
                || lower.contains("high priority complaints")
                || lower.contains("safety complaints");
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

    private int elapsedMs(long startedAt) {
        return (int) ((System.nanoTime() - startedAt) / 1_000_000);
    }
}
