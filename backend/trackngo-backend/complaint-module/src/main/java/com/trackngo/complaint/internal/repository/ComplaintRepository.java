package com.trackngo.complaint.internal.repository;

import com.trackngo.complaint.internal.entity.Complaint;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ComplaintRepository extends JpaRepository<Complaint, Long> {
}
