package com.trackngo.tracking.internal.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.trackngo.commons.exception.ResourceNotFoundException;
import com.trackngo.tracking.api.RouteService;
import com.trackngo.tracking.api.dto.RouteDto;
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
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("RouteController Unit Tests")
class RouteControllerTest {

    private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Mock
    private RouteService service;

    @InjectMocks
    private RouteController controller;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new TestExceptionHandler())
                .build();
    }

    /** Minimal exception handler so 404 tests return 404 instead of 500 */
    @RestControllerAdvice
    static class TestExceptionHandler {
        @ExceptionHandler(ResourceNotFoundException.class)
        org.springframework.http.ResponseEntity<String> handle(ResourceNotFoundException ex) {
            return org.springframework.http.ResponseEntity.status(404).body(ex.getMessage());
        }
    }

    private RouteDto buildDto(Long id, String name) {
        RouteDto dto = new RouteDto();
        dto.setId(id);
        dto.setName(name);
        dto.setCode("CKE-001");
        dto.setType("highway");
        dto.setDistance("120 km");
        dto.setDuration("4h 0m");
        dto.setStops(List.of("Colombo", "Kandy"));
        dto.setBaseFare("Rs.1500");
        dto.setStatus("Active");
        return dto;
    }

    // ─── POST /api/routes ─────────────────────────────────────────────────────

    @Test
    @DisplayName("POST /api/routes: creates route and returns created DTO")
    void create_validRoute_returnsCreated() throws Exception {
        RouteDto input = buildDto(null, "Colombo - Kandy");
        RouteDto saved  = buildDto(1L, "Colombo - Kandy");
        when(service.create(any(RouteDto.class))).thenReturn(saved);

        mockMvc.perform(post("/api/routes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(1))
                .andExpect(jsonPath("$.data.name").value("Colombo - Kandy"));
    }

    // ─── GET /api/routes/{id} ─────────────────────────────────────────────────

    @Test
    @DisplayName("GET /api/routes/{id}: returns existing route")
    void get_existingId_returnsRoute() throws Exception {
        RouteDto dto = buildDto(1L, "Colombo - Kandy");
        when(service.get(1L)).thenReturn(dto);

        mockMvc.perform(get("/api/routes/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(1))
                .andExpect(jsonPath("$.data.name").value("Colombo - Kandy"))
                .andExpect(jsonPath("$.data.distance").value("120 km"));
    }

    @Test
    @DisplayName("GET /api/routes/{id}: returns 404 when route not found")
    void get_nonExistentId_returns404() throws Exception {
        when(service.get(99L)).thenThrow(new ResourceNotFoundException("Route not found"));

        mockMvc.perform(get("/api/routes/99"))
                .andExpect(status().isNotFound());
    }

    // ─── GET /api/routes ──────────────────────────────────────────────────────

    @Test
    @DisplayName("GET /api/routes: returns all routes")
    void getAll_returnsRouteList() throws Exception {
        when(service.getAll()).thenReturn(List.of(
                buildDto(1L, "Colombo - Kandy"),
                buildDto(2L, "Colombo - Galle")
        ));

        mockMvc.perform(get("/api/routes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].name").value("Colombo - Kandy"))
                .andExpect(jsonPath("$.data[1].name").value("Colombo - Galle"));
    }

    @Test
    @DisplayName("GET /api/routes: returns empty array when no routes")
    void getAll_noRoutes_returnsEmpty() throws Exception {
        when(service.getAll()).thenReturn(List.of());

        mockMvc.perform(get("/api/routes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(0));
    }

    // ─── PUT /api/routes/{id} ─────────────────────────────────────────────────

    @Test
    @DisplayName("PUT /api/routes/{id}: updates route and returns updated DTO")
    void update_existingRoute_returnsUpdated() throws Exception {
        RouteDto input   = buildDto(null, "Updated Name");
        RouteDto updated = buildDto(1L, "Updated Name");
        when(service.update(eq(1L), any(RouteDto.class))).thenReturn(updated);

        mockMvc.perform(put("/api/routes/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Updated Name"));
    }

    // ─── DELETE /api/routes/{id} ──────────────────────────────────────────────

    @Test
    @DisplayName("DELETE /api/routes/{id}: deletes route successfully")
    void delete_existingRoute_returnsOk() throws Exception {
        doNothing().when(service).delete(1L);

        mockMvc.perform(delete("/api/routes/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Route deleted"));

        verify(service).delete(1L);
    }

    @Test
    @DisplayName("DELETE /api/routes/{id}: returns 404 when route not found")
    void delete_nonExistentRoute_returns404() throws Exception {
        doThrow(new ResourceNotFoundException("Route not found")).when(service).delete(99L);

        mockMvc.perform(delete("/api/routes/99"))
                .andExpect(status().isNotFound());
    }

    // ─── PATCH /api/routes/{id}/toggle-status ────────────────────────────────

    @Test
    @DisplayName("PATCH /api/routes/{id}/toggle-status: toggles status")
    void toggleStatus_returnsToggledRoute() throws Exception {
        RouteDto toggled = buildDto(1L, "Colombo - Kandy");
        toggled.setStatus("Inactive");
        when(service.toggleStatus(1L)).thenReturn(toggled);

        mockMvc.perform(patch("/api/routes/1/toggle-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("Inactive"));
    }
}
