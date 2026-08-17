package com.trackngo.auth.internal.repository;

import com.trackngo.auth.internal.entity.Admin;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AdminRepository extends JpaRepository<Admin, Long> {
    boolean existsByPhoneNumber(String phoneNumber);

    boolean existsByEmployeeId(String employeeId);
}
