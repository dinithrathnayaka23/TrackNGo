package com.trackngo.booking.internal.repository;

import com.trackngo.booking.internal.entity.Seat;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SeatRepository extends JpaRepository<Seat, Long> {
}
