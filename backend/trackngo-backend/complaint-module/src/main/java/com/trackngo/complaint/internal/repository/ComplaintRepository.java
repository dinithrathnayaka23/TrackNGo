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

    /**
     * Returns complaints filed against a driver. Matches the complaint's own driver_id when set,
     * and falls back to the bus assigned at the time of the booking referenced by the complaint
     * (the same resolution the admin dashboard uses) since driver_id is not always populated.
     */
    @Query(value = """
        SELECT DISTINCT c.*
        FROM complaint c
        LEFT JOIN seat_booking sb ON sb.booking_reference = c.booking_reference
        LEFT JOIN bus b ON b.bus_id = sb.bus_id
        WHERE c.driver_id = :driverId OR b.driver_id = :driverId
        ORDER BY c.created_at DESC
        """, nativeQuery = true)
    List<Complaint> findByDriverId(@Param("driverId") Long driverId);
}