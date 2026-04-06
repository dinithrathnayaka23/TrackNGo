package com.trackngo.booking.internal.repository;

import com.trackngo.booking.internal.entity.Booking;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BookingRepository extends JpaRepository<Booking, Long> {
}
