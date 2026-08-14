package com.trackngo.booking.internal.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.trackngo.booking.api.dto.AdminBusDtos.*;
import com.trackngo.commons.booking.BookingDisruptionHandler;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.KeyHolder;

import java.math.BigDecimal;
import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("AdminBusService Unit Tests")
class AdminBusServiceTest {

    @Mock
    private JdbcTemplate jdbc;

    @Mock
    private ObjectMapper mapper;

    @Mock
    private BookingDisruptionHandler disruptionHandler;

    @InjectMocks
    private AdminBusService service;

    // ─── listBuses ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("listBuses: returns list of BusListItem from DB rows")
    void listBuses_returnsBusList() throws Exception {
        Map<String, Object> row = buildBusRow(1L, "NC-1234", "highway", "active");
        when(jdbc.queryForList(anyString())).thenReturn(List.of(row));
        when(mapper.readValue(anyString(), any(com.fasterxml.jackson.core.type.TypeReference.class)))
                .thenReturn(List.of("ac", "wifi"));

        List<BusListItem> result = service.listBuses();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).busId()).isEqualTo(1L);
        assertThat(result.get(0).busNumber()).isEqualTo("NC-1234");
        assertThat(result.get(0).busType()).isEqualTo("highway");
        assertThat(result.get(0).status()).isEqualTo("active");
    }

    @Test
    @DisplayName("listBuses: returns empty list when no buses exist")
    void listBuses_noBuses_returnsEmpty() {
        when(jdbc.queryForList(anyString())).thenReturn(List.of());

        List<BusListItem> result = service.listBuses();
        assertThat(result).isEmpty();
    }

    // ─── getBusDetail ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("getBusDetail: returns BusDetail for given busId")
    void getBusDetail_validId_returnsBusDetail() throws Exception {
        Map<String, Object> row = buildBusRow(2L, "NC-5678", "highway", "active");
        row.put("driver_id", 10L);
        row.put("driver_name", "John Doe");
        row.put("driver_phone", "+94771234567");
        row.put("average_rating", 4.5);
        row.put("route_id", 5L);
        row.put("route_name", "Colombo - Kandy");
        row.put("fee", new BigDecimal("1500.00"));
        when(jdbc.queryForMap(anyString(), any(Object[].class))).thenReturn(row);
        when(mapper.readValue(anyString(), any(com.fasterxml.jackson.core.type.TypeReference.class)))
                .thenReturn(List.of("ac"));

        BusDetail detail = service.getBusDetail(2L);

        assertThat(detail.busId()).isEqualTo(2L);
        assertThat(detail.busNumber()).isEqualTo("NC-5678");
        assertThat(detail.driverName()).isEqualTo("John Doe");
        assertThat(detail.routeName()).isEqualTo("Colombo - Kandy");
        assertThat(detail.routeFee()).isEqualByComparingTo("1500.00");
    }

    // ─── updateBus ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("updateBus: calls jdbc.update with correct busId")
    void updateBus_callsJdbcUpdate() throws Exception {
        SaveBusRequest req = new SaveBusRequest(
                "NC-1234", "Toyota", 40, "highway", "good",
                "active", List.of("ac"), "08:00", "12:00", "14:00", "18:00",
                "REG-001", "2026-12-31", 1L, 2L
        );
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(1);
        when(mapper.writeValueAsString(any())).thenReturn("[\"ac\"]");

        assertThatNoException().isThrownBy(() -> service.updateBus(1L, req));
        verify(jdbc).update(anyString(), any(Object[].class));
    }

    // ─── deleteBus ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("deleteBus: deletes seat_layout and bus rows")
    void deleteBus_deletesRelatedAndBusRows() {
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(1);

        assertThatNoException().isThrownBy(() -> service.deleteBus(1L));

        // Called twice: once for seat_layout, once for bus
        verify(jdbc, times(2)).update(anyString(), any(Object[].class));
    }

    // ─── getSeatLayout ────────────────────────────────────────────────────────

    @Test
    @DisplayName("getSeatLayout: returns empty list when no layout stored")
    void getSeatLayout_noLayout_returnsEmpty() {
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of());

        List<SeatLayoutRow> result = service.getSeatLayout(1L);
        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("getSeatLayout: returns parsed layout rows")
    void getSeatLayout_storedLayout_parsesCorrectly() {
        Map<String, Object> r1 = new HashMap<>();
        r1.put("seat_label", "A1"); r1.put("row_num", 1);
        r1.put("position_group", "left"); r1.put("position_index", 0);

        Map<String, Object> r2 = new HashMap<>();
        r2.put("seat_label", "A2"); r2.put("row_num", 1);
        r2.put("position_group", "right"); r2.put("position_index", 0);

        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of(r1, r2));

        List<SeatLayoutRow> result = service.getSeatLayout(1L);
        assertThat(result).hasSize(1);
        assertThat(result.get(0).left()).containsExactly("A1");
        assertThat(result.get(0).right()).containsExactly("A2");
    }

    // ─── getDriverOptions ─────────────────────────────────────────────────────

    @Test
    @DisplayName("getDriverOptions: returns driver dropdown items")
    @SuppressWarnings("unchecked")
    void getDriverOptions_returnsDriverList() {
        when(jdbc.query(anyString(), any(RowMapper.class)))
                .thenReturn(List.of(new DriverOption(1L, "John Doe")));

        List<DriverOption> options = service.getDriverOptions();
        assertThat(options).hasSize(1);
        assertThat(options.get(0).driverId()).isEqualTo(1L);
        assertThat(options.get(0).name()).isEqualTo("John Doe");
    }

    // ─── getRouteOptions ──────────────────────────────────────────────────────

    @Test
    @DisplayName("getRouteOptions: returns route dropdown items")
    @SuppressWarnings("unchecked")
    void getRouteOptions_returnsRouteList() {
        when(jdbc.query(anyString(), any(RowMapper.class)))
                .thenReturn(List.of(new RouteOption(1L, "Colombo - Kandy", 240)));

        List<RouteOption> options = service.getRouteOptions();
        assertThat(options).hasSize(1);
        assertThat(options.get(0).routeId()).isEqualTo(1L);
        assertThat(options.get(0).routeName()).isEqualTo("Colombo - Kandy");
        assertThat(options.get(0).durationMins()).isEqualTo(240);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private Map<String, Object> buildBusRow(long busId, String busNumber, String busType, String status) {
        Map<String, Object> row = new HashMap<>();
        row.put("bus_id", busId);
        row.put("bus_number", busNumber);
        row.put("bus_brand", "Toyota");
        row.put("seat_capacity", 40);
        row.put("bus_type", busType);
        row.put("bus_condition", "good");
        row.put("status", status);
        row.put("amenities", "[\"ac\",\"wifi\"]");
        row.put("start_time", java.sql.Time.valueOf("08:00:00"));
        row.put("end_time", java.sql.Time.valueOf("12:00:00"));
        row.put("return_start_time", java.sql.Time.valueOf("14:00:00"));
        row.put("return_end_time", java.sql.Time.valueOf("18:00:00"));
        row.put("registration_number", "REG-001");
        row.put("insurance_exp_date", null);
        row.put("driver_id", null);
        row.put("driver_name", null);
        row.put("route_id", null);
        row.put("route_name", null);
        row.put("estimated_time_duration", null);
        return row;
    }
}
