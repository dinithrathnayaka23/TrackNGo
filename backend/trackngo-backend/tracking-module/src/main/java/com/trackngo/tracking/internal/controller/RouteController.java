
package com.trackngo.tracking.internal.controller;

import com.trackngo.commons.ApiResponse;
import com.trackngo.tracking.api.RouteService;
import com.trackngo.tracking.api.dto.RouteDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/routes")
@RequiredArgsConstructor
public class RouteController {
    private final RouteService service;

    @PostMapping
    public ApiResponse<RouteDto> create(@Valid @RequestBody RouteDto dto) {
        return ApiResponse.ok("Route created", service.create(dto));
    }

    @GetMapping("/{id}")
    public ApiResponse<RouteDto> get(@PathVariable Long id) {
        return ApiResponse.ok("Fetched", service.get(id));
    }

    @GetMapping
    public ApiResponse<List<RouteDto>> getAll() {
        return ApiResponse.ok("Fetched", service.getAll());
    }

    @PutMapping("/{id}")
    public ApiResponse<RouteDto> update(@PathVariable Long id, @Valid @RequestBody RouteDto dto) {
        return ApiResponse.ok("Route updated", service.update(id, dto));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.ok("Route deleted", null);
    }

    @PatchMapping("/{id}/toggle-status")
    public ApiResponse<RouteDto> toggleStatus(@PathVariable Long id) {
        return ApiResponse.ok("Status toggled", service.toggleStatus(id));
    }
}

