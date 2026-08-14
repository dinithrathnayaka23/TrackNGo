package com.trackngo.aiagent.services;

import com.trackngo.aiagent.agents.BookingAgent;
import com.trackngo.aiagent.context.AgentExecutionContext;
import com.trackngo.booking.api.dto.BookingFlowDtos;
import com.trackngo.booking.internal.service.BookingFlowService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@Slf4j
public class BookingAgentService {

    private final BookingFlowService bookingFlowService;

    public BookingAgentService() {
        this.bookingFlowService = null;
    }

    @Autowired
    public BookingAgentService(ObjectProvider<BookingFlowService> bookingFlowService) {
        this.bookingFlowService = bookingFlowService.getIfAvailable();
    }

    public BookingAgent.BookingResponse reserveSeat(BookingAgent.BookingRequest request) {
        log.info("Reserving seat for {} on bus {} on date {}", request.passengerName(), request.busId(), request.date());

        if (bookingFlowService == null) {
            return new BookingAgent.BookingResponse(
                    "SUCCESS",
                    "BKG-" + System.currentTimeMillis(),
                    "Seat reserved successfully in local fallback mode.");
        }

        Long busId = parseBusId(request.busId());
        Long passengerId = request.passengerId();
        AgentExecutionContext.Context context = AgentExecutionContext.get();
        if (passengerId == null && context != null && context.hasUser()) {
            passengerId = context.userId();
        }

        if (busId == null) {
            return needsInfo("Please provide the TrackNGo bus id, for example bus 1 for NB-0012.");
        }
        if (passengerId == null) {
            return needsInfo("Please sign in or provide the passenger id before I create a paid booking.");
        }
        if (isBlank(request.date())) {
            return needsInfo("Please provide the journey date in YYYY-MM-DD format.");
        }
        if (isBlank(request.fromLocation()) || isBlank(request.toLocation())) {
            return needsInfo("Please provide both boarding and destination stops.");
        }

        try {
            BookingFlowDtos.BusDetailResult detail = bookingFlowService.getBusDetails(
                    busId,
                    request.fromLocation(),
                    request.toLocation());
            List<String> seats = resolveSeats(busId, request.date(), request.seatNumbers(), detail);
            if (seats.isEmpty()) {
                return new BookingAgent.BookingResponse(
                        "NO_SEATS",
                        null,
                        "No available seats were found for bus %s on %s.".formatted(busId, request.date()));
            }

            BigDecimal totalAmount = request.totalAmount();
            BigDecimal originalAmount = detail.fee().multiply(BigDecimal.valueOf(seats.size()));
            if (totalAmount == null || totalAmount.compareTo(BigDecimal.ZERO) <= 0) {
                totalAmount = originalAmount;
            }

            String journeyTime = isBlank(request.journeyTime()) ? detail.startTime() : request.journeyTime();
            BookingFlowDtos.BookingConfirmationResult confirmation = bookingFlowService.createBooking(
                    new BookingFlowDtos.CreateBookingRequest(
                            busId,
                            request.date(),
                            journeyTime,
                            seats,
                            "Booked by TrackNGo AI assistant for " + safeName(request.passengerName()),
                            defaultValue(request.paymentMethod(), "ai_counter"),
                            totalAmount,
                            passengerId,
                            request.fromLocation(),
                            request.toLocation(),
                            originalAmount,
                            BigDecimal.ZERO,
                            null,
                            request.promoCode()));

            return new BookingAgent.BookingResponse(
                    "SUCCESS",
                    confirmation.bookingReference(),
                    "Confirmed %s seat(s) on %s from %s to %s. Total %s.".formatted(
                            seats.size(),
                            confirmation.busNumber(),
                            confirmation.fromLocation(),
                            confirmation.toLocation(),
                            "LKR " + confirmation.totalAmount()),
                    confirmation.transactionId(),
                    confirmation.seatNumbers(),
                    "LKR " + confirmation.totalAmount());
        } catch (Exception ex) {
            log.warn("AI booking failed for bus {}: {}", request.busId(), ex.getMessage());
            return new BookingAgent.BookingResponse(
                    "FAILED",
                    null,
                    "I could not complete the booking: " + ex.getMessage());
        }
    }

    private BookingAgent.BookingResponse needsInfo(String message) {
        return new BookingAgent.BookingResponse("NEEDS_INFO", null, message);
    }

    private Long parseBusId(String busId) {
        if (busId == null || busId.isBlank()) {
            return null;
        }
        String digits = busId.replaceAll("[^0-9]", "");
        if (digits.isBlank()) {
            return null;
        }
        try {
            return Long.parseLong(digits);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private List<String> resolveSeats(
            Long busId,
            String date,
            List<String> requestedSeats,
            BookingFlowDtos.BusDetailResult detail) {
        List<String> requested = requestedSeats == null ? List.of() : requestedSeats.stream()
                .filter(seat -> seat != null && !seat.isBlank())
                .map(seat -> seat.trim().toUpperCase(Locale.ROOT))
                .distinct()
                .toList();
        List<String> booked = bookingFlowService.getBookedSeats(busId, date).stream()
                .flatMap(value -> List.of(value.split(",")).stream())
                .map(seat -> seat.trim().toUpperCase(Locale.ROOT))
                .toList();
        List<String> blocked = bookingFlowService.getBlockedSeats(busId).stream()
                .map(seat -> seat.trim().toUpperCase(Locale.ROOT))
                .toList();

        if (!requested.isEmpty()) {
            boolean allAvailable = requested.stream().noneMatch(seat -> booked.contains(seat) || blocked.contains(seat));
            return allAvailable ? requested : List.of();
        }

        List<String> selected = new ArrayList<>();
        for (BookingFlowDtos.SeatLayoutRow row : bookingFlowService.getSeatLayout(busId)) {
            List<String> rowSeats = new ArrayList<>();
            rowSeats.addAll(row.left());
            rowSeats.addAll(row.right());
            if (row.lastRow() != null) {
                rowSeats.addAll(row.lastRow());
            }
            for (String seat : rowSeats) {
                String normalized = seat.toUpperCase(Locale.ROOT);
                if (!booked.contains(normalized) && !blocked.contains(normalized)) {
                    selected.add(normalized);
                    return selected;
                }
            }
        }

        if (detail.seatCapacity() > 0) {
            String fallback = "1A";
            if (!booked.contains(fallback) && !blocked.contains(fallback)) {
                return List.of(fallback);
            }
        }
        return List.of();
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String defaultValue(String value, String fallback) {
        return isBlank(value) ? fallback : value;
    }

    private String safeName(String passengerName) {
        if (!isBlank(passengerName)) {
            return passengerName.trim();
        }
        return "passenger-" + UUID.randomUUID().toString().substring(0, 6);
    }
}
