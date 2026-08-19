
package com.trackngo.auth.internal.repository;

import com.trackngo.auth.internal.entity.PasswordResetOtp;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PasswordResetOtpRepository extends JpaRepository<PasswordResetOtp, Long> {
    List<PasswordResetOtp> findByUserIdAndConsumedFalse(Long userId);

    Optional<PasswordResetOtp> findTopByUserIdAndConsumedFalseOrderByCreatedAtDesc(Long userId);

    Optional<PasswordResetOtp> findByResetTokenAndConsumedFalse(String resetToken);
}
