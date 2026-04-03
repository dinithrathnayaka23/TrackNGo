package com.trackngo.driverfleet.internal.repository;

import com.trackngo.driverfleet.internal.entity.Driver;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DriverRepository extends JpaRepository<Driver, Long> {
}
