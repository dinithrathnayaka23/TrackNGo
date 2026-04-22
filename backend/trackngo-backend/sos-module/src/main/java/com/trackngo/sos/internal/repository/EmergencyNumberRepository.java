package com.trackngo.sos.internal.repository;

import com.trackngo.sos.internal.entity.EmergencyNumber;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface EmergencyNumberRepository extends JpaRepository<EmergencyNumber, Long> {
    Optional<EmergencyNumber> findByIsActiveTrue();
    Optional<EmergencyNumber> findFirstByIsActiveTrueOrderByEmergencyIdAsc();
    long countByIsActiveTrue();

    @Modifying
    @Query("update EmergencyNumber e set e.isActive = false")
    void deactivateAll();

    @Modifying
    @Query("update EmergencyNumber e set e.isActive = false where e.emergencyId <> :emergencyId")
    void deactivateAllExcept(@Param("emergencyId") Long emergencyId);
}
