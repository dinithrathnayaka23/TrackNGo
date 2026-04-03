package com.trackngo.feedbackrating.internal.repository;

import com.trackngo.feedbackrating.internal.entity.Rating;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RatingRepository extends JpaRepository<Rating, Long> {
}
