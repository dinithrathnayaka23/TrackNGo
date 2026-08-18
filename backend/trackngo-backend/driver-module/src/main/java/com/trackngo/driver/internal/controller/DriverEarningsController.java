package com.trackngo.driver.internal.controller;

import com.trackngo.commons.ApiResponse;
import com.trackngo.driver.api.dto.DriverEarningsResponse;
import com.trackngo.driver.internal.service.DriverEarningsService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/drivers")
@RequiredArgsConstructor
public class DriverEarningsController {
    private final DriverEarningsService driverEarningsService;

    @GetMapping("/{driverId}/earnings")
    @PreAuthorize("hasRole('DRIVER')")
    public ApiResponse<DriverEarningsResponse> getDriverEarnings(@PathVariable Long driverId) {
        return ApiResponse.ok("Driver earnings fetched successfully",
                driverEarningsService.getEarnings(driverId));
    }
}
