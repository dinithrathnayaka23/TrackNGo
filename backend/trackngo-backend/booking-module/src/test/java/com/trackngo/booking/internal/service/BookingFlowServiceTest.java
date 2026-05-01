package com.trackngo.booking.internal.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.trackngo.booking.api.dto.BookingFlowDtos.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.sql.Time;
import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("BookingFlowService Unit Tests")
class BookingFlowServiceTest {

    @Mock
    private JdbcTemplate jdbc;

    @Mock
    private ObjectMapper mapper;

    @Mock
    private PromotionService promotionService;

    @InjectMocks
    private BookingFlowService service;

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private Map<String, Object> buildBusRow(long busId, String busNumber, String busType) {
        Map<String, Object> row = new HashMap<>();
        row.put("bus_id", busId);
        row.put("bus_number", busNumber);
        row.put("bus_type", busType);
        row.put("bus_brand", "Toyota");
        row.put("start_time", Time.valueOf("08:00:00"));
        row.put("end_time", Time.valueOf("12:00:00"));
        row.put("seat_capacity", 40);
        row.put("amenities", "[\"ac\",\"wifi\"]");
        row.put("route_fee", new BigDecimal("1500.00"));
        row.put("route_id", 1L);
        row.put("route_name", "Express Route");
        row.put("start_location", "Colombo");
        row.put("end_location", "Kandy");
        row.put("total_distance", 120.0);
        row.put("estimated_time_duration", 240);
        row.put("from_distance", 0.0);
        row.put("to_distance", 120.0);
        row.put("from_stop_name", "Colombo Fort");
        row.put("to_stop_name", "Kandy");
        row.put("from_arrival_mins", 0);
        row.put("to_arrival_mins", 240);
        row.put("average_rating", 4.5);
        row.put("driver_name", "John Doe");
        return row;
    }

    // ─── searchBuses ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("searchBuses: returns empty list when from equals to")
    void searchBuses_sameFromTo_returnsEmpty() {
        List<BusSearchResult> result = service.searchBuses("Colombo", "Colombo", "2025-05-01", null);
        assertThat(result).isEmpty();
        verifyNoInteractions(jdbc);
    }

    @Test
    @DisplayName("searchBuses: returns empty list when from is blank")
    void searchBuses_blankFrom_returnsEmpty() {
        List<BusSearchResult> result = service.searchBuses("", "Kandy", "2025-05-01", null);
        assertThat(result).isEmpty();
        verifyNoInteractions(jdbc);
    }

    @Test
    @DisplayName("searchBuses: returns empty list when to is blank")
    void searchBuses_blankTo_returnsEmpty() {
        List<BusSearchResult> result = service.searchBuses("Colombo", "", "2025-05-01", null);
        assertThat(result).isEmpty();
        verifyNoInteractions(jdbc);
    }

    @Test
    @DisplayName("searchBuses: returns bus results when DB returns rows")
    void searchBuses_validParams_returnsBuses() throws Exception {
        Map<String, Object> busRow = buildBusRow(1L, "NC-1234", "highway");
        Map<String, Object> stopRow1 = new HashMap<>();
        stopRow1.put("name", "Colombo");
        stopRow1.put("priority", 1);
        Map<String, Object> stopRow2 = new HashMap<>();
        stopRow2.put("name", "Kandy");
        stopRow2.put("priority", 10);

        when(jdbc.queryForList(anyString(), any(Object[].class)))
                .thenReturn(List.of(busRow))
                .thenReturn(List.of(stopRow1, stopRow2));

        // countBookedSeats uses queryForObject
        when(jdbc.queryForObject(anyString(), eq(Integer.class), any(Object[].class)))
                .thenReturn(2);

        // amenities parsing
        when(mapper.readValue(anyString(), any(com.fasterxml.jackson.core.type.TypeReference.class)))
                .thenReturn(List.of("ac", "wifi"));

        List<BusSearchResult> results = service.searchBuses("Colombo", "Kandy", "2025-05-01", null);

        assertThat(results).hasSize(1);
        BusSearchResult r = results.get(0);
        assertThat(r.busId()).isEqualTo(1L);
        assertThat(r.busNumber()).isEqualTo("NC-1234");
        assertThat(r.busType()).isEqualTo("highway");
        assertThat(r.seatCapacity()).isEqualTo(40);
        assertThat(r.availableSeats()).isEqualTo(38); // 40 - 2 booked
        assertThat(r.routeStops()).hasSize(2);
    }

    @Test
    @DisplayName("searchBuses: filters by busCategory when provided")
    void searchBuses_withCategory_appendsCategoryFilter() throws Exception {
        when(jdbc.queryForList(anyString(), any(Object[].class)))
                .thenReturn(List.of());

        List<BusSearchResult> results = service.searchBuses("Colombo", "Kandy", "2025-05-01", "highway");
        assertThat(results).isEmpty();

        // Verify DB was called (not short-circuited)
        verify(jdbc, atLeastOnce()).queryForList(anyString(), any(Object[].class));
    }

    @Test
    @DisplayName("searchBuses: normalizes stop names (ignores case, spaces, hyphens)")
    void searchBuses_normalizedStops_treatsKolompoColomboSame() {
        // "Colombo-Fort" should normalize to same as "colombofort"
        // Both "Colombo Fort" and "colombo fort" produce the same key → same/different test
        // With same normalized keys it returns empty
        List<BusSearchResult> result = service.searchBuses("Colombo Fort", "Colombo-Fort", "2025-05-01", null);
        assertThat(result).isEmpty();
        verifyNoInteractions(jdbc);
    }

    // ─── getBookedSeats ───────────────────────────────────────────────────────

    @Test
    @DisplayName("getBookedSeats: returns flat list of seat labels")
    void getBookedSeats_returnsSeatList() {
        when(jdbc.queryForList(anyString(), eq(String.class), any(Object[].class)))
                .thenReturn(List.of("A1,A2", "B1"));

        List<String> booked = service.getBookedSeats(1L, "2025-05-01");

        assertThat(booked).containsExactlyInAnyOrder("A1", "A2", "B1");
    }

    @Test
    @DisplayName("getBookedSeats: returns empty list when no bookings")
    void getBookedSeats_noBookings_returnsEmpty() {
        when(jdbc.queryForList(anyString(), eq(String.class), any(Object[].class)))
                .thenReturn(List.of());

        List<String> booked = service.getBookedSeats(1L, "2025-05-01");
        assertThat(booked).isEmpty();
    }

    // ─── getBlockedSeats ──────────────────────────────────────────────────────

    @Test
    @DisplayName("getBlockedSeats: delegates to jdbc and returns labels")
    void getBlockedSeats_returnsBlockedLabels() {
        when(jdbc.queryForList(anyString(), eq(String.class), any(Object[].class)))
                .thenReturn(List.of("C3", "C4"));

        List<String> blocked = service.getBlockedSeats(1L);
        assertThat(blocked).containsExactly("C3", "C4");
    }

    // ─── getSeatLayout ────────────────────────────────────────────────────────

    @Test
    @DisplayName("getSeatLayout: generates default layout when seat_layout table is empty")
    void getSeatLayout_emptyLayout_generatesDefault() {
        when(jdbc.queryForList(anyString(), any(Object[].class)))
                .thenReturn(List.of());
        when(jdbc.queryForObject(anyString(), eq(Integer.class), any(Object[].class)))
                .thenReturn(40);

        List<SeatLayoutRow> layout = service.getSeatLayout(1L);

        assertThat(layout).isNotEmpty();
        // Default 40-seat layout should produce rows
        assertThat(layout.stream().mapToInt(r -> r.left().size() + r.right().size()).sum())
                .isGreaterThan(0);
    }

    @Test
    @DisplayName("getSeatLayout: parses stored layout from seat_layout table")
    void getSeatLayout_storedLayout_parsesCorrectly() {
        Map<String, Object> seatRow1 = new HashMap<>();
        seatRow1.put("seat_label", "A1");
        seatRow1.put("row_num", 1);
        seatRow1.put("position_group", "left");
        seatRow1.put("position_index", 0);

        Map<String, Object> seatRow2 = new HashMap<>();
        seatRow2.put("seat_label", "A2");
        seatRow2.put("row_num", 1);
        seatRow2.put("position_group", "right");
        seatRow2.put("position_index", 0);

        when(jdbc.queryForList(anyString(), any(Object[].class)))
                .thenReturn(List.of(seatRow1, seatRow2));

        List<SeatLayoutRow> layout = service.getSeatLayout(1L);

        assertThat(layout).hasSize(1);
        assertThat(layout.get(0).rowNum()).isEqualTo(1);
        assertThat(layout.get(0).left()).containsExactly("A1");
        assertThat(layout.get(0).right()).containsExactly("A2");
    }

    // ─── cancelBooking ────────────────────────────────────────────────────────

    @Test
    @DisplayName("cancelBooking: updates status to cancelled for confirmed booking")
    void cancelBooking_confirmedBooking_updatesStatus() {
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(1);

        assertThatNoException().isThrownBy(() -> service.cancelBooking("BK-20250501-ABCD"));
        verify(jdbc).update(anyString(), any(Object[].class));
    }

    @Test
    @DisplayName("cancelBooking: throws RuntimeException when booking not found")
    void cancelBooking_notFound_throwsException() {
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(0);

        assertThatThrownBy(() -> service.cancelBooking("BK-INVALID"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("not found or already cancelled");
    }

    // ─── getBookingByRef ──────────────────────────────────────────────────────

    @Test
    @DisplayName("getBookingByRef: returns booking confirmation from DB")
    void getBookingByRef_existingRef_returnsConfirmation() {
        Map<String, Object> row = new HashMap<>();
        row.put("booking_reference", "BK-20250501-ABCD");
        row.put("status", "confirmed");
        row.put("seat_number", "A1,A2");
        row.put("total_amount", new BigDecimal("2500.00"));
        row.put("journey_date", java.sql.Date.valueOf("2025-05-01"));
        row.put("journey_time", Time.valueOf("08:00:00"));
        row.put("from_stop", "Colombo");
        row.put("to_stop", "Kandy");
        row.put("bus_number", "NC-1234");
        row.put("start_location", "Colombo Fort");
        row.put("end_location", "Kandy");
        row.put("transaction_id", "TXN-12345678");

        when(jdbc.queryForMap(anyString(), any(Object[].class))).thenReturn(row);

        BookingConfirmationResult result = service.getBookingByRef("BK-20250501-ABCD");

        assertThat(result.bookingReference()).isEqualTo("BK-20250501-ABCD");
        assertThat(result.status()).isEqualTo("confirmed");
        assertThat(result.seatNumbers()).isEqualTo("A1,A2");
        assertThat(result.totalAmount()).isEqualByComparingTo("2500.00");
        assertThat(result.fromLocation()).isEqualTo("Colombo");
        assertThat(result.toLocation()).isEqualTo("Kandy");
    }

    @Test
    @DisplayName("getBookingByRef: falls back to route endpoints when from/to stops are null")
    void getBookingByRef_noStops_fallsBackToRouteEndpoints() {
        Map<String, Object> row = new HashMap<>();
        row.put("booking_reference", "BK-20250501-WXYZ");
        row.put("status", "confirmed");
        row.put("seat_number", "B3");
        row.put("total_amount", new BigDecimal("1200.00"));
        row.put("journey_date", java.sql.Date.valueOf("2025-05-01"));
        row.put("journey_time", Time.valueOf("10:00:00"));
        row.put("from_stop", null);
        row.put("to_stop", null);
        row.put("bus_number", "NC-5678");
        row.put("start_location", "Colombo Fort");
        row.put("end_location", "Matara");
        row.put("transaction_id", "TXN-87654321");

        when(jdbc.queryForMap(anyString(), any(Object[].class))).thenReturn(row);

        BookingConfirmationResult result = service.getBookingByRef("BK-20250501-WXYZ");

        assertThat(result.fromLocation()).isEqualTo("Colombo Fort");
        assertThat(result.toLocation()).isEqualTo("Matara");
    }
}
