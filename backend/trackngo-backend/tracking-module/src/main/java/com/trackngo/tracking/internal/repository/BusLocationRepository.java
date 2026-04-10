
package com.trackngo.tracking.internal.repository;

import com.trackngo.tracking.internal.entity.BusLocation;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BusLocationRepository extends JpaRepository<BusLocation, Long> {
}

