package com.trackngo.tracking.internal.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.trackngo.commons.ApiResponse;
import com.trackngo.tracking.api.dto.LiveBusLocationDto;
import com.trackngo.tracking.api.dto.RouteGeometryDto;
import com.trackngo.tracking.api.dto.RouteStopDto;
import com.trackngo.tracking.internal.entity.Route;
import com.trackngo.tracking.internal.entity.RouteStop;
import com.trackngo.tracking.internal.repository.RouteRepository;
import com.trackngo.tracking.internal.websocket.TrackingWebSocketHandler;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.socket.TextMessage;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
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

    /*
      In-memory store of latest bus locations keyed by bus number.
    */
    private final Map<String, LiveBusLocationDto> latestLocations = new ConcurrentHashMap<>();

    /*
      POST /api/tracking/live-location
      Called by another device (e.g. a phone acting as the bus) to publish its current location.
    */
    @PostMapping("/live-location")
    @Transactional
    public ResponseEntity<ApiResponse<LiveBusLocationDto>> publishBusLocation(
            @Valid @RequestBody LiveBusLocationDto dto) {

        if (dto.getTimestamp() == null) {
            dto.setTimestamp(System.currentTimeMillis());
        }

        latestLocations.put(dto.getBusNumber(), dto);

        // Broadcast via WebSocket to all connected clients
        try {
            String json = objectMapper.writeValueAsString(dto);
            trackingWebSocketHandler.broadcast(new TextMessage(json));
        } catch (Exception e) {
            log.error("Failed to broadcast bus location for {}", dto.getBusNumber(), e);
        }

        return ResponseEntity.ok(ApiResponse.ok("Bus location published", dto));
    }

    /*
      GET /api/tracking/live-location/{busNumber}
      Retrieve the last known location of a bus.
    */
    @GetMapping("/live-location/{busNumber}")
    public ResponseEntity<ApiResponse<LiveBusLocationDto>> getLatestBusLocation(
            @PathVariable String busNumber) {

        LiveBusLocationDto location = latestLocations.get(busNumber);
        if (location == null) {
            return ResponseEntity.ok(ApiResponse.ok("No location available", null));
        }
        return ResponseEntity.ok(ApiResponse.ok("Latest bus location", location));
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

        // Try to find a matching route by start/end locations
        Route matched = routes.stream()
                .filter(r -> r.getStartLocation().equalsIgnoreCase(start.trim())
                        && r.getEndLocation().equalsIgnoreCase(end.trim()))
                .findFirst()
                .orElse(null);

        if (matched == null) {
            // Try partial match
            matched = routes.stream()
                    .filter(r -> r.getStartLocation().toLowerCase().contains(start.trim().toLowerCase())
                            || r.getEndLocation().toLowerCase().contains(end.trim().toLowerCase()))
                    .findFirst()
                    .orElse(null);
        }

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
