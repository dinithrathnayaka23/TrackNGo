package com.trackngo.driverfleet.internal.repository;

import com.trackngo.driverfleet.internal.entity.Fleet;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FleetRepository extends JpaRepository<Fleet, Long> {
}
