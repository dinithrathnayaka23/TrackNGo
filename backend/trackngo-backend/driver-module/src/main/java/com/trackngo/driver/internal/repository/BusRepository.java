package com.trackngo.driver.internal.repository;

import com.trackngo.driver.internal.entity.DriverBus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface BusRepository extends JpaRepository<DriverBus, Long> {
    Optional<DriverBus> findByDriverId(Long driverId);
    Optional<DriverBus> findByBusNumber(String busNumber);
}
