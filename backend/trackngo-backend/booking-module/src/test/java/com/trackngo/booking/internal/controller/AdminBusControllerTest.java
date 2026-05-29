package com.trackngo.booking.internal.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.trackngo.booking.api.dto.AdminBusDtos.*;
import com.trackngo.booking.internal.service.AdminBusService;
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
@DisplayName("AdminBusController Unit Tests")
class AdminBusControllerTest {

    private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Mock
    private AdminBusService service;

    @InjectMocks
    private AdminBusController controller;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    // ─── GET /api/admin/buses ─────────────────────────────────────────────────

    @Test
    @DisplayName("GET /api/admin/buses: returns list of buses")
    void listBuses_returnsOk() throws Exception {
        BusListItem bus = new BusListItem(
                1L, "NC-1234", "Toyota", 40, "highway", "good",
                "active", List.of("ac"), "John Doe", 10L,
                "Colombo - Kandy", 1L, "08:00", "12:00", "14:00", "18:00",
                "REG-001", "2026-12-31"
        );
        when(service.listBuses()).thenReturn(List.of(bus));

        mockMvc.perform(get("/api/admin/buses"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].busId").value(1))
                .andExpect(jsonPath("$.data[0].busNumber").value("NC-1234"))
                .andExpect(jsonPath("$.data[0].status").value("active"));
    }

    // ─── GET /api/admin/buses/{busId} ─────────────────────────────────────────

    @Test
    @DisplayName("GET /api/admin/buses/{busId}: returns bus detail")
    void getBusDetail_returnsDetail() throws Exception {
        BusDetail detail = new BusDetail(
                1L, "NC-1234", "Toyota", 40, "highway", "good",
                "active", List.of("ac", "wifi"),
                "08:00", "12:00", "14:00", "18:00", "REG-001", null,
                10L, "John Doe", "+94771234567", 4.5,
                1L, "Colombo - Kandy", new BigDecimal("1500.00")
        );
        when(service.getBusDetail(1L)).thenReturn(detail);

        mockMvc.perform(get("/api/admin/buses/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.busId").value(1))
                .andExpect(jsonPath("$.data.driverName").value("John Doe"))
                .andExpect(jsonPath("$.data.routeFee").value(1500.0));
    }

    // ─── POST /api/admin/buses ────────────────────────────────────────────────

    @Test
    @DisplayName("POST /api/admin/buses: creates bus and returns id")
    void createBus_returnsNewId() throws Exception {
        SaveBusRequest request = new SaveBusRequest(
                "NC-9999", "Toyota", 40, "highway", "good",
                "active", List.of("ac"), "08:00", "12:00", "14:00", "18:00",
                "REG-999", "2026-12-31", 1L, 2L
        );
        when(service.createBus(any(SaveBusRequest.class))).thenReturn(99L);

        mockMvc.perform(post("/api/admin/buses")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").value(99));
    }

    // ─── PUT /api/admin/buses/{busId} ─────────────────────────────────────────

    @Test
    @DisplayName("PUT /api/admin/buses/{busId}: updates bus")
    void updateBus_returnsOk() throws Exception {
        SaveBusRequest request = new SaveBusRequest(
                "NC-1234", "Toyota", 40, "highway", "good",
                "active", List.of(), "08:00", "12:00", "14:00", "18:00",
                "REG-001", "2026-12-31", null, null
        );
        doNothing().when(service).updateBus(eq(1L), any(SaveBusRequest.class));

        mockMvc.perform(put("/api/admin/buses/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Bus updated"));
    }

    // ─── DELETE /api/admin/buses/{busId} ──────────────────────────────────────

    @Test
    @DisplayName("DELETE /api/admin/buses/{busId}: deletes bus")
    void deleteBus_returnsOk() throws Exception {
        doNothing().when(service).deleteBus(1L);

        mockMvc.perform(delete("/api/admin/buses/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Bus deleted"));

        verify(service).deleteBus(1L);
    }

    // ─── GET /api/admin/buses/{busId}/seat-layout ─────────────────────────────

    @Test
    @DisplayName("GET /api/admin/buses/{busId}/seat-layout: returns seat layout")
    void getSeatLayout_returnsLayout() throws Exception {
        SeatLayoutRow row = new SeatLayoutRow(1, List.of("A1", "A2"), List.of("A3", "A4"), null);
        when(service.getSeatLayout(1L)).thenReturn(List.of(row));

        mockMvc.perform(get("/api/admin/buses/1/seat-layout"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].rowNum").value(1))
                .andExpect(jsonPath("$.data[0].left[0]").value("A1"));
    }

    // ─── GET /api/admin/buses/options/drivers ─────────────────────────────────

    @Test
    @DisplayName("GET /api/admin/buses/options/drivers: returns driver options")
    void getDriverOptions_returnsDrivers() throws Exception {
        DriverOption option = new DriverOption(1L, "John Doe");
        when(service.getDriverOptions()).thenReturn(List.of(option));

        mockMvc.perform(get("/api/admin/buses/options/drivers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].driverId").value(1))
                .andExpect(jsonPath("$.data[0].name").value("John Doe"));
    }

    // ─── GET /api/admin/buses/options/routes ──────────────────────────────────

    @Test
    @DisplayName("GET /api/admin/buses/options/routes: returns route options")
    void getRouteOptions_returnsRoutes() throws Exception {
        RouteOption option = new RouteOption(1L, "Colombo - Kandy", 240);
        when(service.getRouteOptions()).thenReturn(List.of(option));

        mockMvc.perform(get("/api/admin/buses/options/routes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].routeId").value(1))
                .andExpect(jsonPath("$.data[0].routeName").value("Colombo - Kandy"))
                .andExpect(jsonPath("$.data[0].durationMins").value(240));
    }
}
