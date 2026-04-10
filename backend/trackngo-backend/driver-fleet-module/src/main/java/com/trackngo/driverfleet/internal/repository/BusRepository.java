package com.trackngo.driverfleet.internal.repository;

import com.trackngo.driverfleet.internal.entity.Bus;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BusRepository extends JpaRepository<Bus, Long> {
}
