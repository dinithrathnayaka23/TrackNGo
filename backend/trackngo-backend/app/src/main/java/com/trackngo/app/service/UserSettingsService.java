package com.trackngo.app.service;

import com.trackngo.app.dto.UpdateUserSettingsRequest;
import com.trackngo.app.dto.UserSettingsDto;
import com.trackngo.commons.exception.ResourceNotFoundException;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

@Service
@RequiredArgsConstructor
public class UserSettingsService {

    private final JdbcTemplate jdbcTemplate;

    @PostConstruct
    void ensureSchema() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS user_settings (
                    user_id BIGINT PRIMARY KEY,
                    language_code VARCHAR(8) NOT NULL DEFAULT 'en',
                    share_location BOOLEAN NOT NULL DEFAULT TRUE,
                    two_factor_authentication BOOLEAN NOT NULL DEFAULT FALSE,
                    push_notifications BOOLEAN NOT NULL DEFAULT TRUE,
                    sms_alerts BOOLEAN NOT NULL DEFAULT FALSE,
                    email_updates BOOLEAN NOT NULL DEFAULT TRUE,
                    booking_updates BOOLEAN NOT NULL DEFAULT TRUE,
                    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    CONSTRAINT fk_user_settings_user FOREIGN KEY (user_id)
                        REFERENCES `user`(user_id) ON DELETE CASCADE
                )
                """);
    }

    @Transactional
    public UserSettingsDto getSettings(Long userId) {
        ensureUserExists(userId);
        ensureSettingsRow(userId);
        return jdbcTemplate.queryForObject("""
                SELECT user_id, language_code, share_location,
                       two_factor_authentication, push_notifications,
                       sms_alerts, email_updates, booking_updates
                FROM user_settings
                WHERE user_id = ?
                """, (rs, rowNum) -> new UserSettingsDto(
                rs.getLong("user_id"),
                rs.getString("language_code"),
                rs.getBoolean("share_location"),
                rs.getBoolean("two_factor_authentication"),
                rs.getBoolean("push_notifications"),
                rs.getBoolean("sms_alerts"),
                rs.getBoolean("email_updates"),
                rs.getBoolean("booking_updates")
        ), userId);
    }

    @Transactional
    public UserSettingsDto updateSettings(Long userId, UpdateUserSettingsRequest request) {
        UserSettingsDto current = getSettings(userId);
        String language = normalizeLanguage(request.language() == null ? current.language() : request.language());

        jdbcTemplate.update("""
                INSERT INTO user_settings (
                    user_id, language_code, share_location, two_factor_authentication,
                    push_notifications, sms_alerts, email_updates, booking_updates
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    language_code = VALUES(language_code),
                    share_location = VALUES(share_location),
                    two_factor_authentication = VALUES(two_factor_authentication),
                    push_notifications = VALUES(push_notifications),
                    sms_alerts = VALUES(sms_alerts),
                    email_updates = VALUES(email_updates),
                    booking_updates = VALUES(booking_updates)
                """,
                userId,
                language,
                valueOr(request.shareLocation(), current.shareLocation()),
                valueOr(request.twoFactorAuthentication(), current.twoFactorAuthentication()),
                valueOr(request.pushNotifications(), current.pushNotifications()),
                valueOr(request.smsAlerts(), current.smsAlerts()),
                valueOr(request.emailUpdates(), current.emailUpdates()),
                valueOr(request.bookingUpdates(), current.bookingUpdates())
        );

        jdbcTemplate.update(
                "UPDATE `user` SET language_preference = ? WHERE user_id = ?",
                language,
                userId
        );

        return getSettings(userId);
    }

    private void ensureUserExists(Long userId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM `user` WHERE user_id = ?",
                Integer.class,
                userId
        );
        if (count == null || count == 0) {
            throw new ResourceNotFoundException("User not found");
        }
    }

    private void ensureSettingsRow(Long userId) {
        jdbcTemplate.update("""
                INSERT IGNORE INTO user_settings (user_id, language_code)
                SELECT user_id, COALESCE(language_preference, 'en')
                FROM `user`
                WHERE user_id = ?
                """, userId);
    }

    private String normalizeLanguage(String language) {
        String normalized = language == null ? "en" : language.trim().toLowerCase(Locale.ROOT);
        if (!normalized.equals("en") && !normalized.equals("si")) {
            throw new IllegalArgumentException("Language must be 'en' or 'si'");
        }
        return normalized;
    }

    private boolean valueOr(Boolean value, boolean fallback) {
        return value == null ? fallback : value;
    }
}
