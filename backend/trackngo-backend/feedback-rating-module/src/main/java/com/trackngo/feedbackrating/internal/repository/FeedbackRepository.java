package com.trackngo.feedbackrating.internal.repository;

import com.trackngo.feedbackrating.internal.entity.Feedback;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FeedbackRepository extends JpaRepository<Feedback, Long> {
}
