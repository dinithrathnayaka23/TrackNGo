package com.trackngo.tracking.internal.controller;

import com.fasterxml.jackson.databind.ObjectMapper; // Jackson JSON library
import com.trackngo.commons.ApiResponse;
import com.trackngo.tracking.api.dto.LiveBusLocationDto;
import com.trackngo.tracking.api.dto.RouteGeometryDto;
import com.trackngo.tracking.api.dto.RouteStopDto;
import com.trackngo.tracking.internal.entity.Route;
import com.trackngo.tracking.internal.entity.RouteStop;
import com.trackngo.tracking.internal.repository.RouteRepository;
import com.trackngo.tracking.internal.service.LiveLocationQualityService;
import com.trackngo.tracking.internal.websocket.TrackingWebSocketHandler;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.socket.TextMessage;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/tracking")
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class LiveTrackingController {

    private final TrackingWebSocketHandler trackingWebSocketHandler;
    private final RouteRepository routeRepository;
    private final ObjectMapper objectMapper;
    private final LiveLocationQualityService liveLocationQualityService;

    /*
      POST /api/tracking/live-location
      Called by a driver device to publish its current GPS fix.

      Fixes that are impossible or too imprecise to be trusted are dropped here
      rather than forwarded to passengers - see LiveLocationQualityService. A
      dropped fix is still a successful request from the driver app's point of
      view (nothing went wrong with the call), so it answers 200 with
      success=false and the last known good position.
    */
    @PostMapping("/live-location")
    @Transactional
    public ResponseEntity<ApiResponse<LiveBusLocationDto>> publishBusLocation(
            @Valid @RequestBody LiveBusLocationDto dto) {

        LiveLocationQualityService.Result result =
                liveLocationQualityService.submit(dto, System.currentTimeMillis());

        if (!result.isAccepted()) {
            return ResponseEntity.ok(ApiResponse.fail(result.getReason(), result.getLocation()));
        }

        LiveBusLocationDto accepted = result.getLocation();

        // Broadcast via WebSocket to all connected clients
        try {
            String json = objectMapper.writeValueAsString(accepted);
            trackingWebSocketHandler.broadcast(new TextMessage(json));
        } catch (Exception e) {
            log.error("Failed to broadcast bus location for {}", accepted.getBusNumber(), e);
        }

        return ResponseEntity.ok(ApiResponse.ok(result.getReason(), accepted));
    }

    /*
      GET /api/tracking/live-location/{busNumber}
      Retrieve the last known good location of a bus, annotated with how old the
      fix is so the caller can decide whether to show it as live.
    */
    @GetMapping("/live-location/{busNumber}")
    public ResponseEntity<ApiResponse<LiveBusLocationDto>> getLatestBusLocation(
            @PathVariable String busNumber) {

        return liveLocationQualityService.latest(busNumber, System.currentTimeMillis())
                .map(location -> ResponseEntity.ok(ApiResponse.ok("Latest bus location", location)))
                .orElseGet(() -> ResponseEntity.ok(ApiResponse.ok("No location available", null)));
    }

    /*
      GET /api/tracking/route-geometry?start={startLocation}&end={endLocation}
      Returns route stops with coordinates for drawing polylines on the map.
    */
    @GetMapping("/route-geometry")
    public ResponseEntity<ApiResponse<RouteGeometryDto>> getRouteGeometry(
            @RequestParam String start,
            @RequestParam String end) {

        List<Route> routes = routeRepository.findAll();

        // Prefer route endpoints, then support any two saved bus stops in the
        // correct direction. Trip booking locations are often intermediate
        // stops, not only the route's start and end locations.
        Route matched = routes.stream()
                .filter(r -> sameLocation(r.getStartLocation(), start)
                        && sameLocation(r.getEndLocation(), end))
                .findFirst()
                .orElseGet(() -> routes.stream()
                        .filter(r -> containsOrderedStops(r, start, end))
                        .findFirst()
                        .orElse(null));

        if (matched == null) {
            return ResponseEntity.ok(ApiResponse.ok("No route found", null));
        }

        RouteGeometryDto geometry = new RouteGeometryDto();
        geometry.setRouteId(matched.getId());
        geometry.setRouteName(matched.getRouteName());
        geometry.setStartLocation(matched.getStartLocation());
        geometry.setEndLocation(matched.getEndLocation());

        if (matched.getStops() != null) {
            List<RouteStopDto> stops = matched.getStops().stream()
                    .map(stop -> {
                        RouteStopDto dto = new RouteStopDto();
                        dto.setName(stop.getName());
                        dto.setLatitude(stop.getLatitude() != null ? stop.getLatitude().doubleValue() : null);
                        dto.setLongitude(stop.getLongitude() != null ? stop.getLongitude().doubleValue() : null);
                        dto.setPriority(stop.getId().getPriority());
                        dto.setDistanceFromStart(stop.getDistanceFromStart() != null
                                ? stop.getDistanceFromStart().doubleValue() : null);
                        dto.setEstimatedArrivalMins(stop.getEstimatedArrivalMins());
                        return dto;
                    })
                    .collect(Collectors.toList());
            geometry.setStops(stops);
        }

        return ResponseEntity.ok(ApiResponse.ok("Route geometry", geometry));
    }

    private boolean containsOrderedStops(Route route, String start, String end) {
        if (route.getStops() == null || route.getStops().isEmpty()) return false;

        int startIndex = -1;
        int endIndex = -1;
        for (int index = 0; index < route.getStops().size(); index++) {
            String stopName = route.getStops().get(index).getName();
            if (startIndex < 0 && sameLocation(stopName, start)) startIndex = index;
            if (endIndex < 0 && sameLocation(stopName, end)) endIndex = index;
        }
        return startIndex >= 0 && endIndex > startIndex;
    }

    private boolean sameLocation(String left, String right) {
        if (left == null || right == null) return false;
        return normalizeLocation(left).equals(normalizeLocation(right));
    }

    private String normalizeLocation(String value) {
        return value.trim().toLowerCase().replaceAll("[^a-z0-9]", "");
    }

    /**
     * GET /api/tracking/routes/{routeId}/geometry
     * Returns route stops with coordinates for a specific route id.
     */
    @GetMapping("/routes/{routeId}/geometry")
    public ResponseEntity<ApiResponse<RouteGeometryDto>> getRouteGeometryById(
            @PathVariable Long routeId) {

        Route route = routeRepository.findByIdWithStops(routeId).orElse(null);
        if (route == null) {
            return ResponseEntity.ok(ApiResponse.ok("No route found", null));
        }

        RouteGeometryDto geometry = new RouteGeometryDto();
        geometry.setRouteId(route.getId());
        geometry.setRouteName(route.getRouteName());
        geometry.setStartLocation(route.getStartLocation());
        geometry.setEndLocation(route.getEndLocation());

        if (route.getStops() != null) {
            List<RouteStopDto> stops = route.getStops().stream()
                    .map(stop -> {
                        RouteStopDto dto = new RouteStopDto();
                        dto.setName(stop.getName());
                        dto.setLatitude(stop.getLatitude() != null ? stop.getLatitude().doubleValue() : null);
                        dto.setLongitude(stop.getLongitude() != null ? stop.getLongitude().doubleValue() : null);
                        dto.setPriority(stop.getId().getPriority());
                        dto.setDistanceFromStart(stop.getDistanceFromStart() != null
                                ? stop.getDistanceFromStart().doubleValue() : null);
                        dto.setEstimatedArrivalMins(stop.getEstimatedArrivalMins());
                        return dto;
                    })
                    .collect(Collectors.toList());
            geometry.setStops(stops);
        }

        return ResponseEntity.ok(ApiResponse.ok("Route geometry", geometry));
    }
}
