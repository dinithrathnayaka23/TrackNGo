package com.trackngo.aiagent.orchestration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.trackngo.aiagent.context.AgentExecutionContext;
import com.trackngo.aiagent.dto.ComplaintAnalysisResponse;
import com.trackngo.aiagent.services.AdminOpsAgentService;
import com.trackngo.aiagent.services.AiConversationMemoryService;
import com.trackngo.aiagent.services.AiGroundingService;
import com.trackngo.aiagent.services.ComplaintAgentService;
import com.trackngo.aiagent.services.RecommendationAgentService;
import com.trackngo.aiagent.services.NotificationAgentService;
import com.trackngo.aiagent.services.TrafficEtaAgentService;
import com.trackngo.aiagent.services.TripPlanningAgentService;
import com.trackngo.booking.api.dto.BookingFlowDtos;
import com.trackngo.booking.api.dto.BookingFlowDtos.BusSearchResult;
import com.trackngo.booking.internal.service.BookingFlowService;
import com.trackngo.complaint.api.ComplaintService;
import com.trackngo.complaint.api.dto.ComplaintDto;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AgentRouterBehaviorTest {

    @AfterEach
    void clearContext() {
        AgentExecutionContext.clear();
    }

    @Test
    void bookingIntentSearchesLiveOptionsBeforeCreatingBooking() {
        BookingFlowService bookingFlowService = mock(BookingFlowService.class);
        when(bookingFlowService.searchBuses("Colombo Fort", "Kandy", "2026-08-01", null))
                .thenReturn(List.of(busOption()));

        AgentRouter router = router(bookingFlowService, mock(ComplaintAgentService.class), mock(ComplaintService.class), mock(JdbcTemplate.class));

        String reply = router.processUserQuery("Book 2 seats from Colombo Fort to Kandy on 2026-08-01 morning", "chat-booking");

        assertTrue(reply.contains("I found these booking options"));
        assertTrue(reply.contains("Confirm bus id 12"));
        verify(bookingFlowService, never()).createBooking(any());
    }
    @Test
    void confirmedBookingUsesDatabaseSafeStripePaymentMethod() {
        BookingFlowService bookingFlowService = mock(BookingFlowService.class);
        when(bookingFlowService.searchBuses("Colombo Fort", "Kandy", "2026-08-01", null))
                .thenReturn(List.of(busOption()));
        when(bookingFlowService.getBookedSeats(12L, "2026-08-01")).thenReturn(List.of());
        when(bookingFlowService.getBlockedSeats(12L)).thenReturn(List.of());
        when(bookingFlowService.createBooking(any())).thenReturn(new BookingFlowDtos.BookingConfirmationResult(
                "BK-20260801-TEST",
                "confirmed",
                "TXN-TEST",
                "1A,1B",
                new BigDecimal("1500.00"),
                "NB-0012",
                "Colombo Fort",
                "Kandy",
                "2026-08-01",
                "08:00"));
        AgentExecutionContext.set(new AgentExecutionContext.Context(4L, "passenger@trackngo.com", "passenger", "chat-booking"));
        AgentRouter router = router(bookingFlowService, mock(ComplaintAgentService.class), mock(ComplaintService.class), mock(JdbcTemplate.class));

        String reply = router.processUserQuery("Confirm bus id 12 seats 1A, 1B from Colombo Fort to Kandy on 2026-08-01 morning", "chat-booking");

        ArgumentCaptor<BookingFlowDtos.CreateBookingRequest> captor = ArgumentCaptor.forClass(BookingFlowDtos.CreateBookingRequest.class);
        verify(bookingFlowService).createBooking(captor.capture());
        assertEquals("stripe", captor.getValue().paymentMethod());
        assertTrue(reply.contains("Booking confirmed"), reply);
    }


    @Test
    void complaintIntentEscalatesSafetyIssueToAdminReview() {
        ComplaintAgentService complaintAgentService = mock(ComplaintAgentService.class);
        ComplaintService complaintService = mock(ComplaintService.class);
        ComplaintDto created = new ComplaintDto();
        created.setId(42L);
        created.setBookingReference("BK-20260728-B41F");
        created.setComplaintType("safety_concern");
        created.setPriority("high");
        created.setDescription("unsafe");
        created.setStatus("pending");

        when(complaintAgentService.analyzeComplaint(any()))
                .thenReturn(new ComplaintAnalysisResponse("SAFETY_INCIDENT", "URGENT", "Unsafe driving", "Contact operator", "OPS_ESCALATION"));
        when(complaintService.create(anyString(), any())).thenReturn(created);
        when(complaintService.update(any(), any())).thenAnswer(invocation -> invocation.getArgument(1));
        AgentExecutionContext.set(new AgentExecutionContext.Context(4L, "passenger@trackngo.com", "passenger", "chat-complaint"));

        AgentRouter router = router(mock(BookingFlowService.class), complaintAgentService, complaintService, mock(JdbcTemplate.class));

        String reply = router.processUserQuery("I want to complain about booking BK-20260728-B41F. The driver was rude and bus was unsafe.", "chat-complaint");

        assertTrue(reply.contains("Complaint submitted to admin"), reply);
        assertTrue(reply.contains("Safety issue flagged"), reply);
        verify(complaintService).create(anyString(), any());
        verify(complaintService).update(any(), any());
    }

    @Test
    void adminQuestionIsAnsweredByTheOperationsAgent() {
        AdminOpsAgentService adminOps = mock(AdminOpsAgentService.class);
        when(adminOps.opsSummary()).thenReturn("**Operations summary** stub");
        AgentExecutionContext.set(new AgentExecutionContext.Context(1L, "admin@trackngo.com", "admin", "chat-admin"));

        AgentRouter router = router(mock(BookingFlowService.class), mock(ComplaintAgentService.class),
                mock(ComplaintService.class), mock(JdbcTemplate.class), adminOps);

        // With no model reachable in tests the admin classifier falls back to the
        // overview, which is enough to prove the admin path reaches the ops agent.
        String reply = router.processUserQuery("how are things looking today", "chat-admin");

        assertTrue(reply.contains("Operations summary"), reply);
    }

    @Test
    void adminComplaintQuestionDoesNotEnterThePassengerComplaintFlow() {
        AdminOpsAgentService adminOps = mock(AdminOpsAgentService.class);
        when(adminOps.opsSummary()).thenReturn("**Operations summary** stub");
        ComplaintAgentService complaintAgentService = mock(ComplaintAgentService.class);
        AgentExecutionContext.set(new AgentExecutionContext.Context(1L, "admin@trackngo.com", "admin", "chat-admin"));

        AgentRouter router = router(mock(BookingFlowService.class), complaintAgentService,
                mock(ComplaintService.class), mock(JdbcTemplate.class), adminOps);

        String reply = router.processUserQuery("show unresolved complaints", "chat-admin");

        // An admin asking about complaints wants the operations view, not to have a
        // complaint filed against their own account.
        assertTrue(reply.contains("Operations summary"), reply);
        verify(complaintAgentService, never()).analyzeComplaint(any());
    }

    private AgentRouter router(
            BookingFlowService bookingFlowService,
            ComplaintAgentService complaintAgentService,
            ComplaintService complaintService,
            JdbcTemplate jdbcTemplate) {
        return router(bookingFlowService, complaintAgentService, complaintService, jdbcTemplate,
                mock(AdminOpsAgentService.class));
    }

    private AgentRouter router(
            BookingFlowService bookingFlowService,
            ComplaintAgentService complaintAgentService,
            ComplaintService complaintService,
            JdbcTemplate jdbcTemplate,
            AdminOpsAgentService adminOpsAgentService) {
        AiConversationMemoryService memory = mock(AiConversationMemoryService.class);
        AiGroundingService grounding = mock(AiGroundingService.class);
        when(memory.recentConversationDigest(anyString(), org.mockito.ArgumentMatchers.anyInt())).thenReturn("");
        when(grounding.buildGroundingDigest(anyString())).thenReturn("");
        return new AgentRouter(
                null,
                "test-primary",
                "test-fallback",
                1,
                false,
                false,
                "",
                "",
                new ObjectMapper(),
                memory,
                grounding,
                mock(TripPlanningAgentService.class),
                mock(TrafficEtaAgentService.class),
                complaintAgentService,
                complaintService,
                mock(RecommendationAgentService.class),
                mock(NotificationAgentService.class),
                bookingFlowService,
                adminOpsAgentService,
                jdbcTemplate);
    }

    private BusSearchResult busOption() {
        return new BusSearchResult(
                12L,
                "NB-0012",
                "highway",
                "Yutong",
                "08:00",
                "11:00",
                45,
                20,
                List.of("wifi"),
                new BigDecimal("750.00"),
                "Driver One",
                4.5,
                "Colombo Fort to Kandy",
                "Colombo Fort to Kandy",
                "Colombo Fort",
                "Kandy",
                List.of());
    }
}