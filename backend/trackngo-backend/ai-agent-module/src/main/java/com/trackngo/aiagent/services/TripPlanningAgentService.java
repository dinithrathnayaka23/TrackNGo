package com.trackngo.aiagent.services;

import com.trackngo.aiagent.agents.TripPlanningAgent;
import com.trackngo.booking.api.dto.BookingFlowDtos.BusSearchResult;
import com.trackngo.booking.internal.service.BookingFlowService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.ObjectProvider;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

@Service
@Slf4j
public class TripPlanningAgentService {

    private final BookingFlowService bookingFlowService;

    public TripPlanningAgentService() {
        this.bookingFlowService = null;
    }

    @Autowired
    public TripPlanningAgentService(ObjectProvider<BookingFlowService> bookingFlowService) {
        this.bookingFlowService = bookingFlowService.getIfAvailable();
    }

    public TripPlanningAgent.RouteResponse findRoutes(TripPlanningAgent.RouteRequest request) {
        log.info("Finding routes for: {} to {} on {}", request.source(), request.destination(), request.date());

        if (bookingFlowService == null) {
            return fallbackRoutes();
        }

        String source = cleanStop(request.source());
        String destination = cleanStop(request.destination());
        String date = resolveDate(request.date());
        if (source.isBlank() || destination.isBlank()) {
            return new TripPlanningAgent.RouteResponse(
                    List.of("Please provide both boarding and destination stops, for example Colombo Fort to Kandy."),
                    List.of(),
                    "low",
                    "validation");
        }

        try {
            List<BusSearchResult> buses = bookingFlowService.searchBuses(
                    source,
                    destination,
                    date,
                    normalizeCategory(request.busCategory()));

            if (buses.isEmpty()) {
                return new TripPlanningAgent.RouteResponse(
                        List.of("No active TrackNGo buses found from %s to %s on %s. Try Colombo Fort, Kandy, Galle, Matara, Jaffna, or Negombo stops exactly as listed.".formatted(source, destination, date)),
                        List.of(),
                        "high",
                        "booking_flow_db");
            }

            List<TripPlanningAgent.RouteOption> options = buses.stream()
                    .filter(Objects::nonNull)
                    .limit(6)
                    .map(bus -> new TripPlanningAgent.RouteOption(
                            bus.busId(),
                            bus.busNumber(),
                            bus.busType(),
                            bus.routeName(),
                            bus.startTime(),
                            bus.endTime(),
                            "LKR " + bus.fee(),
                            bus.availableSeats(),
                            bus.amenities(),
                            buildReason(bus, request.preferredTime())))
                    .toList();

            List<String> routes = options.stream()
                    .map(option -> "%s (%s) leaves %s at %s, arrives %s, %s, %d seats available. %s".formatted(
                            option.busNumber(),
                            readableType(option.busType()),
                            source,
                            option.departureTime(),
                            option.arrivalTime(),
                            option.fare(),
                            option.availableSeats(),
                            option.reason()))
                    .toList();

            return new TripPlanningAgent.RouteResponse(routes, options, "high", "booking_flow_db");
        } catch (Exception ex) {
            log.warn("Route search failed for {} to {}: {}", source, destination, ex.getMessage());
            return new TripPlanningAgent.RouteResponse(
                    List.of("I could not complete the live route search right now. Try again with exact Sri Lankan stop names such as Colombo Fort to Kandy."),
                    List.of(),
                    "low",
                    "error");
        }
    }

    private TripPlanningAgent.RouteResponse fallbackRoutes() {
        return new TripPlanningAgent.RouteResponse(
                List.of(
                        "NB-0012 Colombo to Kandy Express at 05:30 AM, estimated fare LKR 450.00",
                        "NB-0034 Colombo to Galle Highway at 06:00 AM, estimated fare LKR 400.00",
                        "NB-0090 Colombo to Matara at 05:00 AM, estimated fare LKR 550.00"
                ),
                List.of(),
                "low",
                "local_fallback");
    }

    private String cleanStop(String value) {
        return value == null ? "" : value.trim();
    }

    private String resolveDate(String date) {
        if (date == null || date.isBlank()) {
            return LocalDate.now().toString();
        }
        String lower = date.trim().toLowerCase(Locale.ROOT);
        if ("today".equals(lower)) {
            return LocalDate.now().toString();
        }
        if ("tomorrow".equals(lower)) {
            return LocalDate.now().plusDays(1).toString();
        }
        return date.trim();
    }

    private String normalizeCategory(String category) {
        if (category == null || category.isBlank()) {
            return null;
        }
        String normalized = category.trim().toLowerCase(Locale.ROOT).replace("-", "_").replace(" ", "_");
        if (normalized.contains("long")) {
            return "long_distance";
        }
        if (normalized.contains("highway") || normalized.contains("express")) {
            return "highway";
        }
        return normalized;
    }

    private String readableType(String type) {
        if (type == null || type.isBlank()) {
            return "bus";
        }
        return type.replace("_", " ");
    }

    private String buildReason(BusSearchResult bus, String preferredTime) {
        if (bus.availableSeats() <= 0) {
            return "Currently full, useful as a backup if seats reopen.";
        }
        if (preferredTime != null && !preferredTime.isBlank()) {
            if (isWithinPreferredWindow(bus.startTime(), preferredTime)) {
                return "Matches your preferred " + preferredTime.toLowerCase(Locale.ROOT) + " travel window.";
            }
            return "No exact " + preferredTime.toLowerCase(Locale.ROOT) + " bus is currently active, so this is the nearest available TrackNGo option.";
        }
        if (bus.amenities() != null && bus.amenities().contains("wifi")) {
            return "Good comfort option with Wi-Fi.";
        }
        return "Live availability from the TrackNGo booking database.";
    }

    private boolean isWithinPreferredWindow(String startTime, String preferredTime) {
        if (startTime == null || preferredTime == null) {
            return false;
        }
        try {
            LocalTime time = LocalTime.parse(startTime.length() > 5 ? startTime.substring(0, 5) : startTime);
            String preference = preferredTime.toLowerCase(Locale.ROOT);
            if (preference.contains("morning")) {
                return !time.isBefore(LocalTime.of(5, 0)) && time.isBefore(LocalTime.NOON);
            }
            if (preference.contains("afternoon")) {
                return !time.isBefore(LocalTime.NOON) && time.isBefore(LocalTime.of(17, 0));
            }
            if (preference.contains("evening")) {
                return !time.isBefore(LocalTime.of(17, 0)) && time.isBefore(LocalTime.of(21, 0));
            }
            if (preference.contains("night")) {
                return !time.isBefore(LocalTime.of(21, 0)) || time.isBefore(LocalTime.of(5, 0));
            }
            return true;
        } catch (DateTimeParseException ex) {
            return false;
        }
    }
}
