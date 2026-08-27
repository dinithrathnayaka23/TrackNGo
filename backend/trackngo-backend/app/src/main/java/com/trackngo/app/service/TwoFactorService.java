package com.trackngo.app.service;

import com.trackngo.app.dto.TwoFactorCodeRequest;
import com.trackngo.app.dto.TwoFactorSetupDto;
import com.trackngo.commons.exception.BusinessException;
import com.trackngo.commons.exception.ResourceNotFoundException;
import com.trackngo.commons.security.TotpUtil;
import com.trackngo.commons.security.TrustedDeviceService;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class TwoFactorService {
    private final JdbcTemplate jdbcTemplate;
    private final TrustedDeviceService trustedDeviceService;

    @Transactional
    public TwoFactorSetupDto beginSetup(Long userId) {
        String email = requireOwner(userId);
        String secret = TotpUtil.generateSecret();
        ensureSettingsRow(userId);
        jdbcTemplate.update(
                "UPDATE user_settings SET two_factor_pending_secret = ? WHERE user_id = ?",
                secret,
                userId
        );
        return new TwoFactorSetupDto(secret, TotpUtil.provisioningUri(email, secret));
    }

    @Transactional
    public String enable(Long userId, TwoFactorCodeRequest request) {
        requireOwner(userId);
        String code = normalizeCode(request == null ? null : request.code());
        Map<String, Object> settings = getSettings(userId);
        String pendingSecret = (String) settings.get("two_factor_pending_secret");
        if (pendingSecret == null || pendingSecret.isBlank()) {
            throw new BusinessException("Start two-factor setup before enabling it.");
        }
        if (!TotpUtil.isValidCode(pendingSecret, code)) {
            throw new BusinessException("The authenticator code is invalid or expired.");
        }
        jdbcTemplate.update("""
                UPDATE user_settings
                SET two_factor_secret = ?, two_factor_pending_secret = NULL,
                    two_factor_authentication = TRUE, two_factor_enabled_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
                """, pendingSecret, userId);
        return trustedDeviceService.issue(userId);
    }

    @Transactional
    public void disable(Long userId, TwoFactorCodeRequest request) {
        requireOwner(userId);
        String code = normalizeCode(request == null ? null : request.code());
        Map<String, Object> settings = getSettings(userId);
        String secret = (String) settings.get("two_factor_secret");
        if (secret == null || !TotpUtil.isValidCode(secret, code)) {
            throw new BusinessException("The authenticator code is invalid or expired.");
        }
        jdbcTemplate.update("""
                UPDATE user_settings
                SET two_factor_secret = NULL, two_factor_pending_secret = NULL,
                    two_factor_authentication = FALSE, two_factor_enabled_at = NULL
                WHERE user_id = ?
                """, userId);
        trustedDeviceService.revokeAll(userId);
    }

    public boolean isEmailLoginOtpEnabled(Long userId) {
        ensureUserExists(userId);
        ensureSettingsRow(userId);
        Boolean enabled = jdbcTemplate.queryForObject(
                "SELECT email_otp_login_enabled FROM user_settings WHERE user_id = ?",
                Boolean.class,
                userId
        );
        return Boolean.TRUE.equals(enabled);
    }

    @Transactional
    public boolean setEmailLoginOtpEnabled(Long userId, boolean enabled) {
        requireOwner(userId);
        ensureSettingsRow(userId);
        jdbcTemplate.update(
                "UPDATE user_settings SET email_otp_login_enabled = ? WHERE user_id = ?",
                enabled,
                userId
        );
        return enabled;
    }

    public boolean isEnabled(Long userId) {
        ensureUserExists(userId);
        ensureSettingsRow(userId);
        Boolean enabled = jdbcTemplate.queryForObject(
                "SELECT two_factor_authentication FROM user_settings WHERE user_id = ?",
                Boolean.class,
                userId
        );
        return Boolean.TRUE.equals(enabled);
    }

    public boolean verifyLoginCode(Long userId, String code) {
        ensureUserExists(userId);
        Map<String, Object> settings = getSettings(userId);
        return Boolean.TRUE.equals(settings.get("two_factor_authentication"))
                && TotpUtil.isValidCode((String) settings.get("two_factor_secret"), normalizeCode(code));
    }

    private Map<String, Object> getSettings(Long userId) {
        ensureSettingsRow(userId);
        return jdbcTemplate.queryForMap("""
                SELECT two_factor_authentication, two_factor_secret, two_factor_pending_secret
                FROM user_settings WHERE user_id = ?
                """, userId);
    }

    private String requireOwner(Long userId) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || authentication.getName() == null || "anonymousUser".equals(authentication.getName())) {
            throw new BusinessException("You must be logged in to manage two-factor authentication.");
        }
        Map<String, Object> user = jdbcTemplate.queryForMap(
                "SELECT email FROM `user` WHERE user_id = ?", userId);
        if (!authentication.getName().equalsIgnoreCase(String.valueOf(user.get("email")))) {
            throw new BusinessException("You can only manage your own two-factor authentication.");
        }
        return String.valueOf(user.get("email"));
    }

    private void ensureUserExists(Long userId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM `user` WHERE user_id = ?", Integer.class, userId);
        if (count == null || count == 0) throw new ResourceNotFoundException("User not found");
    }

    private void ensureSettingsRow(Long userId) {
        jdbcTemplate.update("""
                INSERT IGNORE INTO user_settings (user_id)
                SELECT user_id FROM `user` WHERE user_id = ?
                """, userId);
    }

    private String normalizeCode(String code) {
        return code == null ? "" : code.replaceAll("\\s", "");
    }
}
