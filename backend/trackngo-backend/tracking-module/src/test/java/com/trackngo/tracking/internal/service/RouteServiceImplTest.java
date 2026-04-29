package com.trackngo.tracking.internal.service;

import com.trackngo.commons.exception.BusinessException;
import com.trackngo.commons.exception.ResourceNotFoundException;
import com.trackngo.tracking.api.dto.RouteDto;
import com.trackngo.tracking.internal.entity.Route;
import com.trackngo.tracking.internal.entity.RouteStop;
import com.trackngo.tracking.internal.entity.RouteStopId;
import com.trackngo.tracking.internal.repository.RouteRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("RouteServiceImpl Unit Tests")
class RouteServiceImplTest {

    @Mock
    private RouteRepository repository;

    @Mock
    private EntityManager entityManager;

    @InjectMocks
    private RouteServiceImpl service;

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private Route buildRoute(Long id, String name, String code, boolean isActive) {
        Route route = new Route();
        route.setId(id);
        route.setRouteName(name);
        route.setRouteCode(code);
        route.setRouteType("highway");
        route.setStartLocation("Colombo");
        route.setEndLocation("Kandy");
        route.setEstDistanceDifference(new BigDecimal("120"));
        route.setEstimatedTimeDuration(240);
        route.setFee(new BigDecimal("1500"));
        route.setActiveBuses(2);
        route.setIsActive(isActive);
        route.setStops(new ArrayList<>());
        return route;
    }

    private RouteDto buildDto(String name, String code, String status) {
        RouteDto dto = new RouteDto();
        dto.setName(name);
        dto.setCode(code);
        dto.setType("highway");
        dto.setDistance("120 km");
        dto.setDuration("4h 0m");
        dto.setStops(List.of("Colombo", "Peradeniya", "Kandy"));
        dto.setBaseFare("Rs.1500");
        dto.setStatus(status);
        return dto;
    }

    // ─── create ───────────────────────────────────────────────────────────────

    @Test
    @DisplayName("create: saves a new route and returns DTO")
    void create_newRoute_savedAndReturned() {
        RouteDto dto = buildDto("Colombo - Kandy Express", "CKE-001", "Active");
        when(repository.existsByRouteCode("CKE-001")).thenReturn(false);

        Route saved = buildRoute(1L, "Colombo - Kandy Express", "CKE-001", true);
        when(repository.save(any(Route.class))).thenReturn(saved);

        RouteDto result = service.create(dto);

        assertThat(result.getId()).isEqualTo(1L);
        assertThat(result.getName()).isEqualTo("Colombo - Kandy Express");
        assertThat(result.getStatus()).isEqualTo("Active");
        verify(repository).save(any(Route.class));
    }

    @Test
    @DisplayName("create: throws BusinessException when route code already exists")
    void create_duplicateCode_throwsBusinessException() {
        RouteDto dto = buildDto("Colombo - Kandy", "CKE-001", "Active");
        when(repository.existsByRouteCode("CKE-001")).thenReturn(true);

        assertThatThrownBy(() -> service.create(dto))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("CKE-001");

        verify(repository, never()).save(any());
    }

    // ─── get ──────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("get: returns RouteDto for existing id")
    void get_existingId_returnsDto() {
        Route route = buildRoute(1L, "Colombo - Kandy", "CKE-001", true);
        when(repository.findById(1L)).thenReturn(Optional.of(route));

        RouteDto result = service.get(1L);

        assertThat(result.getId()).isEqualTo(1L);
        assertThat(result.getName()).isEqualTo("Colombo - Kandy");
        assertThat(result.getCode()).isEqualTo("CKE-001");
    }

    @Test
    @DisplayName("get: throws ResourceNotFoundException when route not found")
    void get_nonExistentId_throwsNotFoundException() {
        when(repository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.get(99L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Route not found");
    }

    // ─── getAll ───────────────────────────────────────────────────────────────

    @Test
    @DisplayName("getAll: returns all routes as DTOs")
    void getAll_returnsAllRoutes() {
        Route r1 = buildRoute(1L, "Colombo - Kandy", "CKE-001", true);
        Route r2 = buildRoute(2L, "Colombo - Galle", "CGE-001", true);
        when(repository.findAll()).thenReturn(List.of(r1, r2));

        List<RouteDto> results = service.getAll();

        assertThat(results).hasSize(2);
        assertThat(results).extracting(RouteDto::getName)
                .containsExactlyInAnyOrder("Colombo - Kandy", "Colombo - Galle");
    }

    @Test
    @DisplayName("getAll: returns empty list when no routes")
    void getAll_noRoutes_returnsEmpty() {
        when(repository.findAll()).thenReturn(List.of());

        assertThat(service.getAll()).isEmpty();
    }

    // ─── update ───────────────────────────────────────────────────────────────

    @Test
    @DisplayName("update: updates existing route and returns updated DTO")
    void update_existingRoute_updatesAndReturns() {
        Route existing = buildRoute(1L, "Old Name", "OLD-001", true);
        when(repository.findById(1L)).thenReturn(Optional.of(existing));
        when(repository.existsByRouteCodeAndIdNot("NEW-001", 1L)).thenReturn(false);

        RouteDto dto = buildDto("New Name", "NEW-001", "Active");
        Route updated = buildRoute(1L, "New Name", "NEW-001", true);
        when(repository.save(any(Route.class))).thenReturn(updated);

        RouteDto result = service.update(1L, dto);

        assertThat(result.getName()).isEqualTo("New Name");
        verify(repository).save(any(Route.class));
    }

    @Test
    @DisplayName("update: throws BusinessException when new code conflicts with another route")
    void update_duplicateCodeOtherRoute_throwsBusinessException() {
        Route existing = buildRoute(1L, "Route A", "AAA-001", true);
        when(repository.findById(1L)).thenReturn(Optional.of(existing));
        when(repository.existsByRouteCodeAndIdNot("BBB-001", 1L)).thenReturn(true);

        RouteDto dto = buildDto("Route A", "BBB-001", "Active");

        assertThatThrownBy(() -> service.update(1L, dto))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("BBB-001");
    }

    @Test
    @DisplayName("update: throws ResourceNotFoundException when route not found")
    void update_nonExistentId_throwsNotFoundException() {
        when(repository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.update(99L, buildDto("X", "X-001", "Active")))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // ─── delete ───────────────────────────────────────────────────────────────

    @Test
    @DisplayName("delete: deletes existing route")
    void delete_existingId_deletesRoute() {
        when(repository.existsById(1L)).thenReturn(true);

        assertThatNoException().isThrownBy(() -> service.delete(1L));
        verify(repository).deleteById(1L);
    }

    @Test
    @DisplayName("delete: throws ResourceNotFoundException when route not found")
    void delete_nonExistentId_throwsNotFoundException() {
        when(repository.existsById(99L)).thenReturn(false);

        assertThatThrownBy(() -> service.delete(99L))
                .isInstanceOf(ResourceNotFoundException.class);

        verify(repository, never()).deleteById(any());
    }

    // ─── toggleStatus ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("toggleStatus: flips active route to inactive")
    void toggleStatus_activeRoute_becomesInactive() {
        Route route = buildRoute(1L, "Colombo - Kandy", "CKE-001", true);
        when(repository.findById(1L)).thenReturn(Optional.of(route));

        Route toggled = buildRoute(1L, "Colombo - Kandy", "CKE-001", false);
        when(repository.save(any(Route.class))).thenReturn(toggled);

        RouteDto result = service.toggleStatus(1L);
        assertThat(result.getStatus()).isEqualTo("Inactive");
    }

    @Test
    @DisplayName("toggleStatus: flips inactive route to active")
    void toggleStatus_inactiveRoute_becomesActive() {
        Route route = buildRoute(1L, "Colombo - Kandy", "CKE-001", false);
        when(repository.findById(1L)).thenReturn(Optional.of(route));

        Route toggled = buildRoute(1L, "Colombo - Kandy", "CKE-001", true);
        when(repository.save(any(Route.class))).thenReturn(toggled);

        RouteDto result = service.toggleStatus(1L);
        assertThat(result.getStatus()).isEqualTo("Active");
    }

    @Test
    @DisplayName("toggleStatus: throws ResourceNotFoundException when route not found")
    void toggleStatus_nonExistentId_throwsNotFoundException() {
        when(repository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.toggleStatus(99L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // ─── DTO mapping ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("get: DTO distance/duration are formatted correctly")
    void get_dtoFormatsDistanceAndDuration() {
        Route route = buildRoute(1L, "Test Route", "TR-001", true);
        // 120 km, 240 mins = 4h 0m
        when(repository.findById(1L)).thenReturn(Optional.of(route));

        RouteDto dto = service.get(1L);

        assertThat(dto.getDistance()).isEqualTo("120 km");
        assertThat(dto.getDuration()).isEqualTo("4h 0m");
        assertThat(dto.getBaseFare()).isEqualTo("Rs.1500");
    }

    @Test
    @DisplayName("get: DTO stops list contains start and end location")
    void get_dtoContainsStops() {
        Route route = buildRoute(1L, "Test Route", "TR-001", true);
        RouteStop stop = new RouteStop();
        stop.setId(new RouteStopId(1L, 1));
        stop.setName("Colombo");
        route.getStops().add(stop);
        when(repository.findById(1L)).thenReturn(Optional.of(route));

        RouteDto dto = service.get(1L);

        assertThat(dto.getStops()).contains("Colombo");
    }
}
