package com.trackngo.admin.internal.controller;

import com.trackngo.admin.api.AdminLogService;
import com.trackngo.admin.api.dto.AdminLogDto;
import com.trackngo.commons.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/adminlogs")
@RequiredArgsConstructor
public class AdminLogController {
    private final AdminLogService service;

    @PostMapping
    public ApiResponse<AdminLogDto> create(@Valid @RequestBody AdminLogDto dto) {
        return ApiResponse.ok("Created", service.create(dto));
    }

    @GetMapping("/{id}")
    public ApiResponse<AdminLogDto> get(@PathVariable Long id) {
        return ApiResponse.ok("Fetched", service.get(id));
    }

    @GetMapping
    public ApiResponse<List<AdminLogDto>> getAll() {
        return ApiResponse.ok("Fetched", service.getAll());
    }

    @PutMapping("/{id}")
    public ApiResponse<AdminLogDto> update(@PathVariable Long id, @Valid @RequestBody AdminLogDto dto) {
        return ApiResponse.ok("Updated", service.update(id, dto));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.ok("Deleted", null);
    }
}
