package com.trackngo.driver.internal.controller;

import com.trackngo.commons.ApiResponse;
import com.trackngo.driver.api.DriverService;
import com.trackngo.driver.api.dto.BusAssignmentDto;
import com.trackngo.driver.api.dto.DriverProfileDto;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/drivers")
@RequiredArgsConstructor
public class DriverFileController {
    private final DriverService driverService;

    @GetMapping("/{driverId}/profile")
    @PreAuthorize("hasRole('DRIVER')")
    public ApiResponse<DriverProfileDto> getDriverProfile(@PathVariable Long driverId) {
        DriverProfileDto profile = driverService.getDriverProfile(driverId);
        return ApiResponse.ok("Driver profile fetched successfully", profile);
    }

    @GetMapping("/{driverId}/assignment")
    @PreAuthorize("hasRole('DRIVER')")
    public ApiResponse<BusAssignmentDto> getCurrentAssignment(@PathVariable Long driverId) {
        BusAssignmentDto assignment = driverService.getCurrentAssignment(driverId);
        if (assignment == null) {
            return ApiResponse.ok("No current assignment", null);
        }
        return ApiResponse.ok("Current assignment fetched successfully", assignment);
    }

    @GetMapping("/{driverId}/profile-and-assignment")
    @PreAuthorize("hasRole('DRIVER')")
    public ApiResponse<ProfileAndAssignmentResponse> getProfileAndAssignment(@PathVariable Long driverId) {
        DriverProfileDto profile = driverService.getDriverProfile(driverId);
        BusAssignmentDto assignment = driverService.getCurrentAssignment(driverId);

        ProfileAndAssignmentResponse response = new ProfileAndAssignmentResponse();
        response.setProfile(profile);
        response.setAssignment(assignment);

        return ApiResponse.ok("Profile and assignment fetched successfully", response);
    }

    @SuppressWarnings("unused")
    public static class ProfileAndAssignmentResponse {
        private DriverProfileDto profile;
        private BusAssignmentDto assignment;

        public DriverProfileDto getProfile() {
            return profile;
        }

        public void setProfile(DriverProfileDto profile) {
            this.profile = profile;
        }

        public BusAssignmentDto getAssignment() {
            return assignment;
        }

        public void setAssignment(BusAssignmentDto assignment) {
            this.assignment = assignment;
        }
    }
}
