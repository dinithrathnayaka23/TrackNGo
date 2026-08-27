
package com.trackngo.auth.internal.repository;

import com.trackngo.auth.internal.entity.LoginOtp;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LoginOtpRepository extends JpaRepository<LoginOtp, Long> {
    List<LoginOtp> findByUserIdAndConsumedFalse(Long userId);

    Optional<LoginOtp> findTopByUserIdAndConsumedFalseOrderByCreatedAtDesc(Long userId);
}
