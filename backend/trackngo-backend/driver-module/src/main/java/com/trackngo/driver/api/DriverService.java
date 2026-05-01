package com.trackngo.driver.api;

import com.trackngo.driver.api.dto.BusAssignmentDto;
import com.trackngo.driver.api.dto.DriverProfileDto;

public interface DriverService {
    DriverProfileDto getDriverProfile(Long driverId);
    BusAssignmentDto getCurrentAssignment(Long driverId);
}
