package com.trackngo.complaint.internal.repository;

import com.trackngo.complaint.internal.entity.Complaint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ComplaintRepository extends JpaRepository<Complaint, Long> {
    /** Returns complaints that belong to the passenger account matched by email. */
    @Query(value = """
        SELECT c.*
        FROM complaint c
        INNER JOIN `user` u ON u.email = :email
        WHERE LOWER(u.user_type) = 'passenger'
          AND c.passenger_id = u.user_id
        ORDER BY c.created_at DESC
        """, nativeQuery = true)
    List<Complaint> findOwnedByEmail(@Param("email") String email);
}