package com.trackngo.driver.internal.service; //package only internal, not exposed outside

import com.trackngo.driver.api.DriverService; //service interface
import com.trackngo.driver.api.dto.BusAssignmentDto; //DTO for bus assignment 
import com.trackngo.driver.api.dto.DriverProfileDto; //DTO 
import com.trackngo.driver.internal.entity.DriverBus; //entity
import com.trackngo.driver.internal.entity.Driver;  //entity
import com.trackngo.driver.internal.entity.DriverUser;  //entity
import com.trackngo.driver.internal.repository.BusRepository; //built in CRUD
import com.trackngo.driver.internal.repository.DriverFileRepository; //built in CRUD
import com.trackngo.driver.internal.repository.UserDriverRepository; //built in CRUD
import com.trackngo.tracking.api.RouteService; 
import com.trackngo.tracking.api.dto.RouteDto;  
import lombok.RequiredArgsConstructor; 
import org.springframework.stereotype.Service; //annonations (@service, @RequiredArgsConstructor etc)
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import com.trackngo.commons.exception.BusinessException;

import java.util.Optional; //import optional keyword from java

@Service // service layer component
@RequiredArgsConstructor //lombok to generate constructor for final fields (repositories and services)
public class DriverServiceImpl implements DriverService {
    private final DriverFileRepository driverFileRepository; 
    private final UserDriverRepository userDriverRepository; //dependancy injec: can access them
    private final BusRepository busRepository;
    private final RouteService routeService; //service layer coming from dinith's part (tracking module)

    @Override
    public DriverProfileDto getDriverProfile(Long driverId) { //interface from service 
        assertDriverOwnsProfile(driverId);
        // Fetch driver details
        Driver driver = driverFileRepository.findByDriverId(driverId) 
                .orElseThrow(() -> new RuntimeException("Driver not found with ID: " + driverId)); //lambda to handle not found case

        // Fetch user details
        DriverUser user = userDriverRepository.findById(driverId) //db data to java obj
                .orElseThrow(() -> new RuntimeException("User not found with ID: " + driverId));

        // Map to DTO
        DriverProfileDto dto = new DriverProfileDto(); //create dto, noargs constructor will be called
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
        dto.setBankName(driver.getBankName());
        dto.setIsPhoneVerified(driver.getIsPhoneVerified());
        //take data from driver entity and set it in dto
        return dto; //send to controller and then to frontend , in json format (jackson's work)
    }

    @Override
    public BusAssignmentDto getCurrentAssignment(Long driverId) { //from controller
        assertDriverOwnsProfile(driverId);
        return computeAssignment(driverId);
    }

    @Override
    public BusAssignmentDto getAssignmentForAdmin(Long driverId) {
        if (!userDriverRepository.existsById(driverId)) {
            throw new BusinessException("Driver account not found.");
        }
        return computeAssignment(driverId);
    }

    private BusAssignmentDto computeAssignment(Long driverId) {
        // Fetch bus assigned to driver
        Optional<DriverBus> busOptional = busRepository.findFirstByDriverIdOrderByBusIdAsc(driverId); //go to bus table (Driverbus entity) and find by driver id (may or may not exist so wrap it in optional)

        if (busOptional.isEmpty()) {
            return null; // No current assignment
        }

        DriverBus bus = busOptional.get(); //get the bus

        // Map to DTO
        BusAssignmentDto dto = new BusAssignmentDto();
        dto.setBusId(bus.getBusId()); // get the data from bus entity and then set it in dto format to return to controller and then to frontend
        dto.setBusNumber(bus.getBusNumber());
        dto.setBusBrand(bus.getBusBrand());
        dto.setRegistrationNumber(bus.getRegistrationNumber());
        dto.setStartTime(bus.getStartTime());
        dto.setEndTime(bus.getEndTime());
        dto.setReturnStartTime(bus.getReturnStartTime());
        dto.setReturnEndTime(bus.getReturnEndTime());
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
            return route != null ? route.getName() : null; //if route is not null return name else return null
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private void assertDriverOwnsProfile(Long driverId) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || authentication.getName() == null
                || "anonymousUser".equals(authentication.getName())) {
            throw new BusinessException("You must be logged in as a driver.");
        }
        DriverUser user = userDriverRepository.findById(driverId)
                .orElseThrow(() -> new BusinessException("Driver account not found."));
        if (!authentication.getName().equalsIgnoreCase(user.getEmail())) {
            throw new BusinessException("You can only view your own driver profile.");
        }
    }
}
