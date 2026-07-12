package com.trackngo.aiagent.agents;

import com.trackngo.aiagent.services.BookingAgentService;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class BookingAgentTest {

    @Test
    void shouldCreateBookingResponse() {
        BookingAgent bookingAgent = new BookingAgent(new BookingAgentService());
        BookingAgent.BookingRequest request = new BookingAgent.BookingRequest("BUS-101", "Alice", "2026-07-15");

        var function = bookingAgent.reserveSeat();
        BookingAgent.BookingResponse response = function.apply(request);

        assertNotNull(response);
        assertEquals("SUCCESS", response.status());
        assertTrue(response.bookingReference().startsWith("BKG-"));
        assertTrue(response.message().contains("success"));
    }
}
