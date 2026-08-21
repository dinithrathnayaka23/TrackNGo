package com.trackngo.commons.security;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

/** Manages long-lived, revocable device credentials for 2FA-protected accounts. */
@Service
@RequiredArgsConstructor
public class TrustedDeviceService {
    private static final int TOKEN_BYTES = 32;
    private static final int MAX_DEVICES_PER_USER = 10;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final JdbcTemplate jdbcTemplate;

    @PostConstruct
    void ensureSchema() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS trusted_two_factor_devices (
                    device_id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    user_id BIGINT NOT NULL,
                    token_hash CHAR(64) NOT NULL UNIQUE,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    last_used_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    revoked_at TIMESTAMP NULL,
                    CONSTRAINT fk_trusted_2fa_device_user FOREIGN KEY (user_id)
                        REFERENCES `user`(user_id) ON DELETE CASCADE,
                    INDEX idx_trusted_2fa_device_user (user_id),
                    INDEX idx_trusted_2fa_device_lookup (user_id, token_hash)
                )
                """);
    }

    @Transactional
    public String issue(Long userId) {
        String rawToken = generateToken();
        jdbcTemplate.update(
                "DELETE FROM trusted_two_factor_devices WHERE user_id = ? AND (revoked_at IS NOT NULL OR expires_at <= CURRENT_TIMESTAMP)",
                userId
        );
        while (deviceCount(userId) >= MAX_DEVICES_PER_USER) {
            Long oldestDevice = jdbcTemplate.queryForObject(
                    "SELECT device_id FROM trusted_two_factor_devices WHERE user_id = ? ORDER BY last_used_at ASC LIMIT 1",
                    Long.class,
                    userId
            );
            if (oldestDevice == null) {
                break;
            }
            jdbcTemplate.update("DELETE FROM trusted_two_factor_devices WHERE device_id = ?", oldestDevice);
        }
        jdbcTemplate.update("""
                INSERT INTO trusted_two_factor_devices (user_id, token_hash, expires_at)
                VALUES (?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 180 DAY))
                """, userId, hash(rawToken));
        return rawToken;
    }

    @Transactional
    public boolean isTrusted(Long userId, String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return false;
        }
        try {
            int updated = jdbcTemplate.update("""
                    UPDATE trusted_two_factor_devices
                    SET last_used_at = CURRENT_TIMESTAMP
                    WHERE user_id = ? AND token_hash = ?
                      AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP
                    """, userId, hash(rawToken));
            return updated == 1;
        } catch (DataAccessException ex) {
            return false;
        }
    }

    @Transactional
    public void revokeAll(Long userId) {
        jdbcTemplate.update(
                "UPDATE trusted_two_factor_devices SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL",
                userId
        );
    }

    private int deviceCount(Long userId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM trusted_two_factor_devices WHERE user_id = ? AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP",
                Integer.class,
                userId
        );
        return count == null ? 0 : count;
    }

    private String generateToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hash(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is unavailable", ex);
        }
    }
}
