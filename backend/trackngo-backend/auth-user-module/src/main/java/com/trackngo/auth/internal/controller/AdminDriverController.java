package com.trackngo.auth.internal.controller;

import com.trackngo.auth.api.UserService;
import com.trackngo.auth.api.dto.AdminDriverDto;
import com.trackngo.auth.api.dto.SaveDriverRequest;
import com.trackngo.commons.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/drivers")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminDriverController {
    private final UserService userService;

    @GetMapping
    public ApiResponse<List<AdminDriverDto>> getAll() {
        return ApiResponse.ok("Drivers fetched", userService.getAllDrivers());
    }

    @PostMapping
    public ApiResponse<AdminDriverDto> create(@Valid @RequestBody SaveDriverRequest request) {
        return ApiResponse.ok("Driver created", userService.createDriver(request));
    }

    @GetMapping("/{id}")
    public ApiResponse<AdminDriverDto> get(@PathVariable Long id) {
        return ApiResponse.ok("Driver fetched", userService.getDriver(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<AdminDriverDto> update(
            @PathVariable Long id,
            @Valid @RequestBody SaveDriverRequest request
    ) {
        return ApiResponse.ok("Driver updated", userService.updateDriver(id, request));
    }
}
