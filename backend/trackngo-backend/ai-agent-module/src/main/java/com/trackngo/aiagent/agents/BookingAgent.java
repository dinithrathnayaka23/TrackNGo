package com.trackngo.aiagent.agents;

import com.trackngo.aiagent.services.BookingAgentService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Description;

import java.util.function.Function;
import java.math.BigDecimal;
import java.util.List;

@Configuration
@Slf4j
public class BookingAgent {

    private final BookingAgentService bookingAgentService;

    public BookingAgent(BookingAgentService bookingAgentService) {
        this.bookingAgentService = bookingAgentService;
    }

    public record BookingRequest(
            String busId,
            String passengerName,
            String date,
            List<String> seatNumbers,
            Long passengerId,
            String fromLocation,
            String toLocation,
            String journeyTime,
            String paymentMethod,
            BigDecimal totalAmount,
            String promoCode) {
        public BookingRequest(String busId, String passengerName, String date) {
            this(busId, passengerName, date, List.of(), null, null, null, null, null, null, null);
        }
    }

    public record BookingResponse(
            String status,
            String bookingReference,
            String message,
            String transactionId,
            String seatNumbers,
            String totalAmount) {
        public BookingResponse(String status, String bookingReference, String message) {
            this(status, bookingReference, message, null, null, null);
        }
    }

    @Bean
    @Description("Reserves seats on a specific bus and handles the initial booking process.")
    public Function<BookingRequest, BookingResponse> reserveSeat() {
        return bookingAgentService::reserveSeat;
    }
}
