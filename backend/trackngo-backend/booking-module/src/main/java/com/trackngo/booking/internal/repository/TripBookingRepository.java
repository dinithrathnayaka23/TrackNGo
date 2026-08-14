package com.trackngo.booking.internal.repository;

import com.trackngo.booking.internal.entity.TripBooking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Step 2: The Repository (The Database Translator)
 * 
 * This is an Interface, not a Class! 
 * By simply extending "JpaRepository", Spring Boot automatically writes ALL the 
 * basic SQL code for us in the background. 
 * 
 * We get methods like .save(), .findAll(), and .findById() for free!
 */
@Repository // Tells Spring Boot that this file is responsible for talking to the Database
public interface TripBookingRepository extends JpaRepository<TripBooking, Long> {
    
    // Notice how we don't write any code inside the method?
    // Spring Boot looks at the method name "findByPassengerId" and automatically 
    // generates the SQL: "SELECT * FROM trip_booking WHERE passenger_id = ?"
    List<TripBooking> findByPassengerId(Long passengerId);
    
    // Similarly, this automatically finds all bookings with a specific status
    List<TripBooking> findByBookingStatus(String bookingStatus);
}
