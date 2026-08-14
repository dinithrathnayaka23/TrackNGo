package com.trackngo.driver.internal.controller; 

import com.trackngo.commons.ApiResponse; // standard wrapper for API responses return 
import com.trackngo.driver.api.DriverService; //service interface
import com.trackngo.driver.api.dto.BusAssignmentDto; //DTO for bus assignment details
import com.trackngo.driver.api.dto.DriverProfileDto; //DTO for driver profile details
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize; //security
import org.springframework.web.bind.annotation.*; //annotations for API endpoints

@RestController                   //REST API 
@RequestMapping("/api/drivers")   //endpoint begin with, this is an annotation
@RequiredArgsConstructor          //lombok automated constr
public class DriverFileController {
    private final DriverService driverService;   //connect to serviceL (dependency injection)

    @GetMapping("/{driverId}/profile")  //endp1
    @PreAuthorize("hasRole('DRIVER')")  //safety
    public ApiResponse<DriverProfileDto> getDriverProfile(@PathVariable Long driverId) { //get by id
        DriverProfileDto profile = driverService.getDriverProfile(driverId);
        return ApiResponse.ok("Driver profile fetched successfully", profile);
    }

    @GetMapping("/{driverId}/assignment")  //endp2
    @PreAuthorize("hasRole('DRIVER')")
    public ApiResponse<BusAssignmentDto> getCurrentAssignment(@PathVariable Long driverId) {
        BusAssignmentDto assignment = driverService.getCurrentAssignment(driverId);
        if (assignment == null) {
            return ApiResponse.ok("No current assignment", null);
        }
        return ApiResponse.ok("Current assignment fetched successfully", assignment);
    }

    @GetMapping("/{driverId}/profile-and-assignment")  //endp3
    @PreAuthorize("hasRole('DRIVER')")
    public ApiResponse<ProfileAndAssignmentResponse> getProfileAndAssignment(@PathVariable Long driverId) {
        DriverProfileDto profile = driverService.getDriverProfile(driverId);
        BusAssignmentDto assignment = driverService.getCurrentAssignment(driverId);

        ProfileAndAssignmentResponse response = new ProfileAndAssignmentResponse(); //no need for constructor becoz it's done by lombok
        response.setProfile(profile);
        response.setAssignment(assignment);

        return ApiResponse.ok("Profile and assignment fetched successfully", response);
    }

    @SuppressWarnings("unused")
    public static class ProfileAndAssignmentResponse { //it is used to hold profile and assignment after getting them
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
