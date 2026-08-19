package com.trackngo.feedbackrating.internal.repository;

import com.trackngo.feedbackrating.internal.entity.Rating;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RatingRepository extends JpaRepository<Rating, Long> {
    Optional<Rating> findByBookingReferenceAndPassengerId(String bookingReference, Long passengerId);
}
