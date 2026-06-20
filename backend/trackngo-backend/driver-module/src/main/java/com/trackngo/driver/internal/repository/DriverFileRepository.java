package com.trackngo.driver.internal.repository;

import com.trackngo.driver.internal.entity.Driver;
import org.springframework.data.jpa.repository.JpaRepository; //built in CRUD for db access
import org.springframework.stereotype.Repository; //annonations

import java.util.Optional;

@Repository //tell java that this is a repository
public interface DriverFileRepository extends JpaRepository<Driver, Long> { //this repo manages from driver entity(table), pk type long
    Optional<Driver> findByPhoneNumber(String phoneNumber);  //optional beocz it can be null
    Optional<Driver> findByLicenseNumber(String licenseNumber); 
    Optional<Driver> findByDriverId(Long driverId);
}
