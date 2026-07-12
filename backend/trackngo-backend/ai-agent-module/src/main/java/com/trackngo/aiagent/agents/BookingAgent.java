package com.trackngo.aiagent.agents;

import com.trackngo.aiagent.services.BookingAgentService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Description;

import java.util.function.Function;

@Configuration
@Slf4j
public class BookingAgent {

    private final BookingAgentService bookingAgentService;

    public BookingAgent(BookingAgentService bookingAgentService) {
        this.bookingAgentService = bookingAgentService;
    }

    public record BookingRequest(String busId, String passengerName, String date) {}
    public record BookingResponse(String status, String bookingReference, String message) {}

    @Bean
    @Description("Reserves seats on a specific bus and handles the initial booking process.")
    public Function<BookingRequest, BookingResponse> reserveSeat() {
        return bookingAgentService::reserveSeat;
    }
}
