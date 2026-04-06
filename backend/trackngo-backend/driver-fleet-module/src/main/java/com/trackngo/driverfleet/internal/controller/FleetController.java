package com.trackngo.driverfleet.internal.controller;

import com.trackngo.driverfleet.api.FleetService;
import com.trackngo.driverfleet.api.dto.FleetDto;
import com.trackngo.commons.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/fleets")
@RequiredArgsConstructor
public class FleetController {
    private final FleetService service;

    @PostMapping
    public ApiResponse<FleetDto> create(@Valid @RequestBody FleetDto dto) {
        return ApiResponse.ok("Created", service.create(dto));
    }

    @GetMapping("/{id}")
    public ApiResponse<FleetDto> get(@PathVariable Long id) {
        return ApiResponse.ok("Fetched", service.get(id));
    }

    @GetMapping
    public ApiResponse<List<FleetDto>> getAll() {
        return ApiResponse.ok("Fetched", service.getAll());
    }

    @PutMapping("/{id}")
    public ApiResponse<FleetDto> update(@PathVariable Long id, @Valid @RequestBody FleetDto dto) {
        return ApiResponse.ok("Updated", service.update(id, dto));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.ok("Deleted", null);
    }
}
