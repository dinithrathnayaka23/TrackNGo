package com.trackngo.aiagent.agents;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Description;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;

@Configuration
@Slf4j
public class BookingAgent {

    public record BookingRequest(String busId, String passengerName, String date) {}
    public record BookingResponse(String status, String bookingReference, String message) {}

    @Bean
    @Description("Reserves seats on a specific bus and handles the initial booking process.")
    public Function<BookingRequest, BookingResponse> reserveSeat() {
        return request -> {
            log.info("Reserving seat for {} on bus {} on date {}", request.passengerName(), request.busId(), request.date());
            // Mocking the response for now. Will connect to booking-module
            return new BookingResponse("SUCCESS", "BKG-" + System.currentTimeMillis(), "Seat reserved successfully.");
        };
    }
}
