package com.trackngo.driver.internal.repository;

import com.trackngo.driver.internal.entity.DriverUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserDriverRepository extends JpaRepository<DriverUser, Long> { //give all the built in find methods, not just below
    Optional<DriverUser> findByEmail(String email); //find user using email (hybernate generate the sql)
}
