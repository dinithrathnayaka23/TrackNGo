package com.trackngo.driver.internal.service;

import com.trackngo.driver.api.DriverService;
import com.trackngo.driver.api.dto.BusAssignmentDto;
import com.trackngo.driver.api.dto.DriverProfileDto;
import com.trackngo.driver.internal.entity.DriverBus;
import com.trackngo.driver.internal.entity.Driver;
import com.trackngo.driver.internal.entity.DriverUser;
import com.trackngo.driver.internal.repository.BusRepository;
import com.trackngo.driver.internal.repository.DriverFileRepository;
import com.trackngo.driver.internal.repository.UserDriverRepository;
import com.trackngo.tracking.api.RouteService;
import com.trackngo.tracking.api.dto.RouteDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class DriverServiceImpl implements DriverService {
    private final DriverFileRepository driverFileRepository;
    private final UserDriverRepository userDriverRepository;
    private final BusRepository busRepository;
    private final RouteService routeService;

    @Override
    public DriverProfileDto getDriverProfile(Long driverId) {
        // Fetch driver details
        Driver driver = driverFileRepository.findByDriverId(driverId)
                .orElseThrow(() -> new RuntimeException("Driver not found with ID: " + driverId));

        // Fetch user details
        DriverUser user = userDriverRepository.findById(driverId)
                .orElseThrow(() -> new RuntimeException("User not found with ID: " + driverId));

        // Map to DTO
        DriverProfileDto dto = new DriverProfileDto();
        dto.setDriverId(driver.getDriverId());
        dto.setFirstName(user.getFirstName());
        dto.setLastName(user.getLastName());
        dto.setEmail(user.getEmail());
        dto.setPhoneNumber(driver.getPhoneNumber());
        dto.setProfilePhoto(driver.getProfilePhoto());
        dto.setLicenseNumber(driver.getLicenseNumber());
        dto.setLicenceExpiry(driver.getLicenceExpiry());
        dto.setYearsOfExperience(driver.getYearsOfExperience());
        dto.setJoinedDate(driver.getJoinedDate());
        dto.setStatus(driver.getStatus());
        dto.setIsVerified(driver.getIsVerified());
        dto.setAverageRating(driver.getAverageRating());
        dto.setDriverEarnings(driver.getDriverEarnings());
        dto.setAccountNumber(driver.getAccountNumber());
        dto.setIsPhoneVerified(driver.getIsPhoneVerified());

        return dto;
    }

    @Override
    public BusAssignmentDto getCurrentAssignment(Long driverId) {
        // Fetch bus assigned to driver
        Optional<DriverBus> busOptional = busRepository.findByDriverId(driverId);

        if (busOptional.isEmpty()) {
            return null; // No current assignment
        }

        DriverBus bus = busOptional.get();

        // Map to DTO
        BusAssignmentDto dto = new BusAssignmentDto();
        dto.setBusId(bus.getBusId());
        dto.setBusNumber(bus.getBusNumber());
        dto.setBusBrand(bus.getBusBrand());
        dto.setRegistrationNumber(bus.getRegistrationNumber());
        dto.setStartTime(bus.getStartTime());
        dto.setEndTime(bus.getEndTime());
        dto.setSeatCapacity(bus.getSeatCapacity());
        dto.setBusCondition(bus.getBusCondition());
        dto.setBusType(bus.getBusType());
        dto.setStatus(bus.getStatus());
        dto.setInsuranceExpDate(bus.getInsuranceExpDate());
        dto.setAmenities(bus.getAmenities());
        dto.setRouteId(bus.getRouteId());
        dto.setRouteName(getRouteName(bus.getRouteId()));

        return dto;
    }

    private String getRouteName(Long routeId) {
        if (routeId == null) {
            return null;
        }

        try {
            RouteDto route = routeService.get(routeId);
            return route != null ? route.getName() : null;
        } catch (RuntimeException ex) {
            return null;
        }
    }
}
