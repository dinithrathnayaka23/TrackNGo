package com.trackngo.driver.internal.repository; //the db access layer

import com.trackngo.driver.internal.entity.DriverBus; //entity
import org.springframework.data.jpa.repository.JpaRepository; //Jpa for CRUD
import org.springframework.stereotype.Repository;

import java.util.Optional; //optional, because it can be null

@Repository
public interface BusRepository extends JpaRepository<DriverBus, Long> {
    Optional<DriverBus> findByDriverId(Long driverId);
    Optional<DriverBus> findByBusNumber(String busNumber);
}
