package com.trackngo.driverfleet.internal.controller;

import com.trackngo.driverfleet.api.BusService;
import com.trackngo.driverfleet.api.dto.BusDto;
import com.trackngo.commons.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/buss")
@RequiredArgsConstructor
public class BusController {
    private final BusService service;

    @PostMapping
    public ApiResponse<BusDto> create(@Valid @RequestBody BusDto dto) {
        return ApiResponse.ok("Created", service.create(dto));
    }

    @GetMapping("/{id}")
    public ApiResponse<BusDto> get(@PathVariable Long id) {
        return ApiResponse.ok("Fetched", service.get(id));
    }

    @GetMapping
    public ApiResponse<List<BusDto>> getAll() {
        return ApiResponse.ok("Fetched", service.getAll());
    }

    @PutMapping("/{id}")
    public ApiResponse<BusDto> update(@PathVariable Long id, @Valid @RequestBody BusDto dto) {
        return ApiResponse.ok("Updated", service.update(id, dto));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.ok("Deleted", null);
    }
}
