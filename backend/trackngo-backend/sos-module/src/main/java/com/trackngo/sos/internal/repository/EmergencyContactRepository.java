package com.trackngo.sos.internal.repository;

import com.trackngo.sos.internal.entity.EmergencyContact;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EmergencyContactRepository extends JpaRepository<EmergencyContact, Long> {
    List<EmergencyContact> findByOwnerIdAndOwnerTypeOrderByCreatedAtDesc(Long ownerId, String ownerType);
}
