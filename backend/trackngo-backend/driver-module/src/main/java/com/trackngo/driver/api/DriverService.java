package com.trackngo.driver.api; //package name

import com.trackngo.driver.api.dto.BusAssignmentDto; //DTO for bus assignment details
import com.trackngo.driver.api.dto.DriverProfileDto; //DTO for driver profile details

public interface DriverService {
    DriverProfileDto getDriverProfile(Long driverId);
    BusAssignmentDto getCurrentAssignment(Long driverId);
}
