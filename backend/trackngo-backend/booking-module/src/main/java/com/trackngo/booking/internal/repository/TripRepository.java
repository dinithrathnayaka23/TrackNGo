package com.trackngo.booking.internal.repository;

import com.trackngo.booking.internal.entity.Trip;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TripRepository extends JpaRepository<Trip, Long> {
}
