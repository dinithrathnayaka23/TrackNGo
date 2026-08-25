
package com.trackngo.auth.internal.repository;

import com.trackngo.auth.internal.entity.RegistrationOtp;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RegistrationOtpRepository extends JpaRepository<RegistrationOtp, Long> {
    List<RegistrationOtp> findByEmailAndConsumedFalse(String email);

    Optional<RegistrationOtp> findTopByEmailAndConsumedFalseOrderByCreatedAtDesc(String email);

    Optional<RegistrationOtp> findByVerificationTokenAndConsumedFalse(String verificationToken);
}
