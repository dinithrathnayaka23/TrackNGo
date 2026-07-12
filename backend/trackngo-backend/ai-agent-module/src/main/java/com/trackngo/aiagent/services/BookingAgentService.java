package com.trackngo.aiagent.services;

import com.trackngo.aiagent.agents.BookingAgent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class BookingAgentService {

    public BookingAgent.BookingResponse reserveSeat(BookingAgent.BookingRequest request) {
        log.info("Reserving seat for {} on bus {} on date {}", request.passengerName(), request.busId(), request.date());

        return new BookingAgent.BookingResponse(
                "SUCCESS",
                "BKG-" + System.currentTimeMillis(),
                "Seat reserved successfully."
        );
    }
}
