package com.trackngo.driver.internal.repository; //the db access layer

import com.trackngo.driver.internal.entity.DriverBus; //entity
import org.springframework.data.jpa.repository.JpaRepository; //Jpa for CRUD
import org.springframework.stereotype.Repository;

import java.util.Optional; //optional, because it can be null

@Repository
public interface BusRepository extends JpaRepository<DriverBus, Long> {
    /**
     * "First" makes this tolerant of a driver who (pre-existing data, or a bug
     * elsewhere) ends up on more than one bus row - the plain findBy variant
     * throws IncorrectResultSizeDataAccessException in that case, which took
     * down the driver app's assignment/profile screens with a 500. The admin
     * bus service now rejects double-assignment at save time, and a database
     * migration repairs and constrains existing data, but this stays as a
     * defense-in-depth guard against ever crashing on it again.
     */
    Optional<DriverBus> findFirstByDriverIdOrderByBusIdAsc(Long driverId);
    Optional<DriverBus> findByBusNumber(String busNumber);
}
