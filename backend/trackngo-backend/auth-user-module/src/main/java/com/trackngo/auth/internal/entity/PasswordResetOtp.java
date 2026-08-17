
package com.trackngo.auth.internal.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Entity
@Data
@Table(name = "password_reset_otp")
public class PasswordResetOtp {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "channel", nullable = false, length = 16)
    private String channel; // EMAIL or PHONE

    @Column(name = "destination", nullable = false)
    private String destination;

    @Column(name = "otp_hash", nullable = false)
    private String otpHash;

    @Column(name = "reset_token")
    private String resetToken;

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
