package com.trackngo.booking.internal.controller;

import com.trackngo.booking.api.SeatService;
import com.trackngo.booking.api.dto.SeatDto;
import com.trackngo.commons.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/seats")
@RequiredArgsConstructor
public class SeatController {
    private final SeatService service;

    @PostMapping
    public ApiResponse<SeatDto> create(@Valid @RequestBody SeatDto dto) {
        return ApiResponse.ok("Created", service.create(dto));
    }

    @GetMapping("/{id}")
    public ApiResponse<SeatDto> get(@PathVariable Long id) {
        return ApiResponse.ok("Fetched", service.get(id));
    }

    @GetMapping
    public ApiResponse<List<SeatDto>> getAll() {
        return ApiResponse.ok("Fetched", service.getAll());
    }

    @PutMapping("/{id}")
    public ApiResponse<SeatDto> update(@PathVariable Long id, @Valid @RequestBody SeatDto dto) {
        return ApiResponse.ok("Updated", service.update(id, dto));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.ok("Deleted", null);
    }
}
