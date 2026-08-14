package com.trackngo.driverfleet.internal.repository;

import com.trackngo.driverfleet.internal.entity.FleetDriver;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FleetDriverRepository extends JpaRepository<FleetDriver, Long> {
}
