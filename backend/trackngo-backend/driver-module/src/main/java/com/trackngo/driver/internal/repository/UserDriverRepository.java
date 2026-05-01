package com.trackngo.driver.internal.repository;

import com.trackngo.driver.internal.entity.DriverUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserDriverRepository extends JpaRepository<DriverUser, Long> {
    Optional<DriverUser> findByEmail(String email);
}
