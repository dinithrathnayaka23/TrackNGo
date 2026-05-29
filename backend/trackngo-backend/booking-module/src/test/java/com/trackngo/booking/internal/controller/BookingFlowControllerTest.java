package com.trackngo.booking.internal.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.trackngo.booking.api.dto.BookingFlowDtos.*;
import com.trackngo.booking.internal.service.BookingFlowService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("BookingFlowController Unit Tests")
class BookingFlowControllerTest {

    private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Mock
    private BookingFlowService service;

    @InjectMocks
    private BookingFlowController controller;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    // ─── GET /api/booking-flow/search ─────────────────────────────────────────

    @Test
    @DisplayName("GET /search: returns 200 with bus list")
    void searchBuses_returnsOk() throws Exception {
        BusSearchResult bus = new BusSearchResult(
                1L, "NC-1234", "highway", "Toyota",
                "08:00", "12:00", 40, 38,
                List.of("ac", "wifi"),
                new BigDecimal("1500.00"),
                "John Doe", 4.5,
                "Colombo - Kandy",
                "Colombo Fort to Kandy",
                "Colombo Fort",
                "Kandy",
                List.of()
        );
        when(service.searchBuses("Colombo", "Kandy", "2025-05-01", null))
                .thenReturn(List.of(bus));

        mockMvc.perform(get("/api/booking-flow/search")
                        .param("from", "Colombo")
                        .param("to", "Kandy")
                        .param("date", "2025-05-01"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].busId").value(1))
                .andExpect(jsonPath("$.data[0].busNumber").value("NC-1234"))
                .andExpect(jsonPath("$.data[0].availableSeats").value(38));
    }

    @Test
    @DisplayName("GET /search: passes busCategory param when present")
    void searchBuses_withCategory_passesCategoryToService() throws Exception {
        when(service.searchBuses("Colombo", "Kandy", "2025-05-01", "highway"))
                .thenReturn(List.of());

        mockMvc.perform(get("/api/booking-flow/search")
                        .param("from", "Colombo")
                        .param("to", "Kandy")
                        .param("date", "2025-05-01")
                        .param("busCategory", "highway"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());

        verify(service).searchBuses("Colombo", "Kandy", "2025-05-01", "highway");
    }

    // ─── GET /api/booking-flow/buses/{busId}/details ──────────────────────────

    @Test
    @DisplayName("GET /buses/{busId}/details: returns bus detail")
    void getBusDetails_returnsOk() throws Exception {
        BusDetailResult detail = new BusDetailResult(
                1L, "NC-1234", "highway", "Toyota",
                "08:00", "12:00", 40,
                List.of("ac"),
                new BigDecimal("1500.00"),
                "Colombo - Kandy",
                "Colombo Fort to Kandy",
                "Colombo Fort",
                "Kandy",
                "120 km", "4h 0m",
                List.of(new BusDetailResult.RouteStopInfo("Colombo Fort", "08:00 AM", 1)),
                new BusDetailResult.DriverInfo("John Doe", "+94771234567", 4.5, null)
        );
        when(service.getBusDetails(1L, "Colombo", "Kandy")).thenReturn(detail);

        mockMvc.perform(get("/api/booking-flow/buses/1/details")
                        .param("from", "Colombo")
                        .param("to", "Kandy"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.busId").value(1))
                .andExpect(jsonPath("$.data.busNumber").value("NC-1234"))
                .andExpect(jsonPath("$.data.routeDistance").value("120 km"));
    }

    // ─── GET /api/booking-flow/buses/{busId}/seat-layout ─────────────────────

    @Test
    @DisplayName("GET /buses/{busId}/seat-layout: returns layout rows")
    void getSeatLayout_returnsLayout() throws Exception {
        SeatLayoutRow row = new SeatLayoutRow(1, List.of("A1", "A2"), List.of("A3", "A4"), null);
        when(service.getSeatLayout(1L)).thenReturn(List.of(row));

        mockMvc.perform(get("/api/booking-flow/buses/1/seat-layout"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].rowNum").value(1))
                .andExpect(jsonPath("$.data[0].left[0]").value("A1"));
    }

    // ─── GET /api/booking-flow/buses/{busId}/booked-seats ────────────────────

    @Test
    @DisplayName("GET /buses/{busId}/booked-seats: returns booked seat labels")
    void getBookedSeats_returnsSeats() throws Exception {
        when(service.getBookedSeats(1L, "2025-05-01")).thenReturn(List.of("A1", "B2"));

        mockMvc.perform(get("/api/booking-flow/buses/1/booked-seats")
                        .param("date", "2025-05-01"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0]").value("A1"))
                .andExpect(jsonPath("$.data[1]").value("B2"));
    }

    // ─── GET /api/booking-flow/buses/{busId}/blocked-seats ───────────────────

    @Test
    @DisplayName("GET /buses/{busId}/blocked-seats: returns blocked seat labels")
    void getBlockedSeats_returnsSeats() throws Exception {
        when(service.getBlockedSeats(2L)).thenReturn(List.of("C3"));

        mockMvc.perform(get("/api/booking-flow/buses/2/blocked-seats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0]").value("C3"));
    }

    // ─── POST /api/booking-flow/bookings ─────────────────────────────────────

    @Test
    @DisplayName("POST /bookings: creates booking and returns confirmation")
    void createBooking_returnsConfirmation() throws Exception {
        CreateBookingRequest request = new CreateBookingRequest(
                1L, "2025-05-01", "08:00",
                List.of("A1", "A2"),
                null, "stripe",
                new BigDecimal("3000.00"),
                100L,
                "Colombo", "Kandy",
                new BigDecimal("3000.00"), BigDecimal.ZERO,
                null, null
        );
        BookingConfirmationResult confirmation = new BookingConfirmationResult(
                "BK-20250501-ABCD", "confirmed", "TXN-ABCD1234",
                "A1,A2", new BigDecimal("3000.00"),
                "NC-1234", "Colombo", "Kandy",
                "2025-05-01", "08:00"
        );
        when(service.createBooking(any(CreateBookingRequest.class))).thenReturn(confirmation);

        mockMvc.perform(post("/api/booking-flow/bookings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.bookingReference").value("BK-20250501-ABCD"))
                .andExpect(jsonPath("$.data.status").value("confirmed"))
                .andExpect(jsonPath("$.data.seatNumbers").value("A1,A2"));
    }

    // ─── GET /api/booking-flow/bookings/{bookingRef} ──────────────────────────

    @Test
    @DisplayName("GET /bookings/{bookingRef}: returns booking details")
    void getBooking_returnsDetails() throws Exception {
        BookingConfirmationResult confirmation = new BookingConfirmationResult(
                "BK-20250501-ABCD", "confirmed", "TXN-ABCD1234",
                "A1", new BigDecimal("1500.00"),
                "NC-1234", "Colombo", "Kandy",
                "2025-05-01", "08:00"
        );
        when(service.getBookingByRef("BK-20250501-ABCD")).thenReturn(confirmation);

        mockMvc.perform(get("/api/booking-flow/bookings/BK-20250501-ABCD"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.bookingReference").value("BK-20250501-ABCD"))
                .andExpect(jsonPath("$.data.busNumber").value("NC-1234"));
    }

    // ─── PUT /api/booking-flow/bookings/{bookingRef}/cancel ──────────────────

    @Test
    @DisplayName("PUT /bookings/{bookingRef}/cancel: cancels booking")
    void cancelBooking_returnsOk() throws Exception {
        doNothing().when(service).cancelBooking("BK-20250501-ABCD");

        mockMvc.perform(put("/api/booking-flow/bookings/BK-20250501-ABCD/cancel"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Booking cancelled"));

        verify(service).cancelBooking("BK-20250501-ABCD");
    }
}
