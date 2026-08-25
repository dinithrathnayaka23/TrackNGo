
package com.trackngo.auth.internal.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * A verification code for a not-yet-created account. Unlike PasswordResetOtp
 * this is keyed by email rather than user_id, since the user doesn't exist
 * in the `user` table until registration completes.
 */
@Entity
@Data
@Table(name = "registration_otp")
public class RegistrationOtp {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "email", nullable = false, length = 254)
    private String email;

    @Column(name = "otp_hash", nullable = false)
    private String otpHash;

    @Column(name = "verification_token")
    private String verificationToken;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "verified_at")
    private LocalDateTime verifiedAt;

    @Column(name = "consumed", nullable = false)
    private Boolean consumed = false;

    @Column(name = "attempts", nullable = false)
    private Integer attempts = 0;

    @Column(name = "last_sent_at", nullable = false)
    private LocalDateTime lastSentAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
