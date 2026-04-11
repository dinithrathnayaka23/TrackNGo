package com.trackngo.sos.internal.repository;

import com.trackngo.sos.internal.entity.EmergencyNumber;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface EmergencyNumberRepository extends JpaRepository<EmergencyNumber, Long> {
    Optional<EmergencyNumber> findByIsActiveTrue();
}
