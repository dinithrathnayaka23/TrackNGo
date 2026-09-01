
package com.trackngo.auth.internal.service;

import com.trackngo.auth.api.AuthService;
import com.trackngo.auth.api.dto.AdminRegisterRequest;
import com.trackngo.auth.api.dto.AuthRequest;
import com.trackngo.auth.api.dto.AuthResponse;
import com.trackngo.auth.api.dto.ResendTwoFactorOtpRequest;
import com.trackngo.auth.api.dto.TwoFactorVerifyRequest;
import com.trackngo.auth.events.UserRegisteredEvent;
import com.trackngo.auth.internal.entity.Admin;
import com.trackngo.auth.internal.entity.LoginOtp;
import com.trackngo.auth.internal.entity.User;
import com.trackngo.auth.internal.repository.AdminRepository;
import com.trackngo.auth.internal.repository.LoginOtpRepository;
import com.trackngo.auth.internal.repository.UserRepository;
import com.trackngo.auth.internal.service.notify.OtpEmailSender;
import com.trackngo.commons.events.EventPublisher;
import com.trackngo.commons.exception.BusinessException;
import com.trackngo.commons.util.JwtUtil; // import JwtUtil
import com.trackngo.commons.security.TotpUtil;
import com.trackngo.commons.security.TrustedDeviceService;
import io.jsonwebtoken.Claims;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {
    private static final int LOGIN_OTP_LENGTH = 6;
    private static final long LOGIN_OTP_EXPIRY_MINUTES = 5;
    private static final long LOGIN_OTP_RESEND_COOLDOWN_SECONDS = 30;
    private static final int LOGIN_OTP_MAX_ATTEMPTS = 5;

    private final UserRepository userRepository;
    private final AdminRepository adminRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final EventPublisher eventPublisher;
    private final JdbcTemplate jdbcTemplate;
    private final TrustedDeviceService trustedDeviceService;
    private final LoginOtpRepository loginOtpRepository;
    private final OtpEmailSender otpEmailSender;

    private final SecureRandom secureRandom = new SecureRandom();

    @PostConstruct
    void ensureLoginOtpSchema() {
        // ddl-auto=update should create this via the LoginOtp entity, but that
        // relies on a fresh restart picking up the new mapping. Self-healing here
        // avoids a repeat of the missing password_reset_otp table surprise.
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS login_otp (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    user_id BIGINT NOT NULL,
                    otp_hash VARCHAR(255) NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    consumed BOOLEAN NOT NULL DEFAULT FALSE,
                    attempts INT NOT NULL DEFAULT 0,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT fk_login_otp_user
                        FOREIGN KEY (user_id) REFERENCES `user`(user_id) ON DELETE CASCADE,
                    INDEX idx_login_otp_user (user_id, consumed)
                )
                """);
    }
     
    // ═══════════════════════════════════════════════════════════
    // 1. LOGIN - Used by ALL user types (passenger, driver, admin)
    // ═══════════════════════════════════════════════════════════

    @Override
    public AuthResponse login(AuthRequest request) {
        User user = userRepository.findByIdentifier(request.getIdentifier().trim())
            .orElseThrow(() -> new BusinessException("Invalid credentials"));
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new BusinessException("Invalid credentials");
        }
        if (isSuspended(user)) {
            throw new BusinessException("Your account is suspended. Please contact the administrator.");
        }
        if (Boolean.FALSE.equals(user.getIsActive())) {
            throw new BusinessException("Account is inactive.");
        }
    //access control-passenger cant login to admin account 
        String requestedUserType = normalizeUserType(request.getExpectedUserType());
        String actualUserType = normalizeUserType(user.getUserType());

        if (requestedUserType != null && !requestedUserType.equals(actualUserType)) {
            throw new BusinessException("Access denied. " + toDisplayRole(requestedUserType) + " account required.");
        }

        boolean totpEnabled = isTwoFactorEnabled(user.getId());
        boolean emailOtpEnabled = !totpEnabled && isEmailOtpLoginEnabled(user.getId());

        if ((totpEnabled || emailOtpEnabled)
                && !trustedDeviceService.isTrusted(user.getId(), request.getTrustedDeviceToken())) {
            String challengeToken = jwtUtil.generateToken(
                    user.getEmail(),
                    Map.of("purpose", "2fa", "userId", user.getId(), "role", actualUserType, "userType", actualUserType),
                    5 * 60 * 1000L
            );
            if (emailOtpEnabled) {
                sendLoginOtp(user);
            }
            return new AuthResponse(null, user.getId(), user.getUserType(), user.getEmail(), user.getFirstName(), user.getLastName(), true, challengeToken, null);
        }
        return authenticatedResponse(user, null);
    }
  // ═══════════════════════════════════════════════════════════
    // 2. REGISTER - Creates NEW passenger accounts
    // ═══════════════════════════════════════════════════════════

    @Override
    public AuthResponse register(AuthRequest request) {
        if (userRepository.existsByEmail(request.getIdentifier())) {
            throw new BusinessException("Email already exists");
        }
        User user = new User();
        user.setEmail(request.getIdentifier());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setUserType("passenger");
        user.setIsActive(true);
        user.setIsEmailVerified(false);
        User saved = userRepository.save(user);
        eventPublisher.publish(new UserRegisteredEvent(saved.getId()));
        String token = jwtUtil.generateToken(saved.getEmail(), Map.of("role", saved.getUserType(), "userType", saved.getUserType()));
        return authenticatedResponse(saved, null);
    }
    
    // ═══════════════════════════════════════════════════════════
    // 4. TWO-FACTOR VERIFICATION - Used by ALL user types
    // ═══════════════════════════════════════════════════════════

    @Override
    public AuthResponse verifyTwoFactor(TwoFactorVerifyRequest request) {
        Claims claims;
        try {
            claims = jwtUtil.parse(request.getChallengeToken());
        } catch (Exception ex) {
            throw new BusinessException("The two-factor challenge has expired. Please log in again.");
        }

        if (!"2fa".equals(claims.get("purpose", String.class))) {
            throw new BusinessException("Invalid two-factor challenge.");
        }

        String email = claims.getSubject();
        Number userIdClaim = claims.get("userId", Number.class);
        if (email == null || userIdClaim == null || !verifyCode(userIdClaim.longValue(), request.getCode())) {
            throw new BusinessException("The verification code is invalid or expired.");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException("Invalid two-factor challenge."));
        return authenticatedResponse(user, trustedDeviceService.issue(user.getId()));
    }

    @Override
    @Transactional
    public void resendTwoFactorOtp(ResendTwoFactorOtpRequest request) {
        Claims claims;
        try {
            claims = jwtUtil.parse(request.getChallengeToken());
        } catch (Exception ex) {
            throw new BusinessException("The two-factor challenge has expired. Please log in again.");
        }

        if (!"2fa".equals(claims.get("purpose", String.class))) {
            throw new BusinessException("Invalid two-factor challenge.");
        }

        Number userIdClaim = claims.get("userId", Number.class);
        if (userIdClaim == null) {
            throw new BusinessException("Invalid two-factor challenge.");
        }
        Long userId = userIdClaim.longValue();

        if (isTwoFactorEnabled(userId)) {
            throw new BusinessException("Your account uses an authenticator app. There is no code to resend.");
        }
        if (!isEmailOtpLoginEnabled(userId)) {
            throw new BusinessException("Invalid two-factor challenge.");
        }

        LoginOtp last = loginOtpRepository.findTopByUserIdAndConsumedFalseOrderByCreatedAtDesc(userId).orElse(null);
        if (last != null) {
            long secondsSinceLastSend = ChronoUnit.SECONDS.between(last.getCreatedAt(), LocalDateTime.now());
            if (secondsSinceLastSend < LOGIN_OTP_RESEND_COOLDOWN_SECONDS) {
                long remaining = LOGIN_OTP_RESEND_COOLDOWN_SECONDS - secondsSinceLastSend;
                throw new BusinessException("Please wait " + remaining + " more second(s) before requesting a new code");
            }
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("Account no longer exists"));
        sendLoginOtp(user);
    }

    private AuthResponse authenticatedResponse(User user, String trustedDeviceToken) {
        String userType = normalizeUserType(user.getUserType());
        String token = jwtUtil.generateToken(
                user.getEmail(),
                Map.of("role", userType, "userType", userType)
        );
        return new AuthResponse(token, user.getId(), user.getUserType(), user.getEmail(), user.getFirstName(), user.getLastName(), false, null, trustedDeviceToken);
    }

    private boolean isTwoFactorEnabled(Long userId) {
        try {
            Map<String, Object> settings = jdbcTemplate.queryForMap(
                    "SELECT two_factor_authentication, two_factor_secret FROM user_settings WHERE user_id = ?",
                    userId
            );
            return Boolean.TRUE.equals(settings.get("two_factor_authentication"))
                    && settings.get("two_factor_secret") instanceof String secret
                    && !secret.isBlank();
        } catch (DataAccessException ex) {
            return false;
        }
    }

    private boolean isSuspended(User user) {
        String table;
        String idColumn;
        switch (normalizeUserType(user.getUserType())) {
            case "passenger" -> {
                table = "passenger";
                idColumn = "passenger_id";
            }
            case "driver" -> {
                table = "driver";
                idColumn = "driver_id";
            }
            case "corporate" -> {
                table = "corporate_user";
                idColumn = "corporate_user_id";
            }
            default -> {
                return false;
            }
        }
        try {
            String status = jdbcTemplate.queryForObject(
                    "SELECT status FROM " + table + " WHERE " + idColumn + " = ?",
                    String.class,
                    user.getId()
            );
            return "suspended".equalsIgnoreCase(status);
        } catch (DataAccessException ex) {
            return false;
        }
    }

    private boolean verifyCode(Long userId, String code) {
        if (isTwoFactorEnabled(userId)) {
            try {
                String secret = jdbcTemplate.queryForObject(
                        "SELECT two_factor_secret FROM user_settings WHERE user_id = ?",
                        String.class, userId
                );
                return TotpUtil.isValidCode(secret, code);
            } catch (DataAccessException ex) {
                return false;
            }
        }
        if (isEmailOtpLoginEnabled(userId)) {
            return verifyEmailLoginOtp(userId, code);
        }
        return false;
    }

    private boolean isEmailOtpLoginEnabled(Long userId) {
        try {
            Boolean enabled = jdbcTemplate.queryForObject(
                    "SELECT email_otp_login_enabled FROM user_settings WHERE user_id = ?",
                    Boolean.class, userId
            );
            return Boolean.TRUE.equals(enabled);
        } catch (DataAccessException ex) {
            return false;
        }
    }

    private void sendLoginOtp(User user) {
        invalidateOutstandingLoginOtps(user.getId());

        String otpCode = generateLoginOtp();
        LocalDateTime now = LocalDateTime.now();

        LoginOtp otp = new LoginOtp();
        otp.setUserId(user.getId());
        otp.setOtpHash(passwordEncoder.encode(otpCode));
        otp.setExpiresAt(now.plusMinutes(LOGIN_OTP_EXPIRY_MINUTES));
        otp.setConsumed(false);
        otp.setAttempts(0);
        otp.setCreatedAt(now);
        loginOtpRepository.save(otp);

        otpEmailSender.sendLoginOtp(user.getEmail(), otpCode, (int) LOGIN_OTP_EXPIRY_MINUTES);
    }

    private boolean verifyEmailLoginOtp(Long userId, String code) {
        LoginOtp otp = loginOtpRepository.findTopByUserIdAndConsumedFalseOrderByCreatedAtDesc(userId).orElse(null);
        if (otp == null || otp.getExpiresAt().isBefore(LocalDateTime.now()) || otp.getAttempts() >= LOGIN_OTP_MAX_ATTEMPTS) {
            return false;
        }
        if (!passwordEncoder.matches(code == null ? "" : code.trim(), otp.getOtpHash())) {
            otp.setAttempts(otp.getAttempts() + 1);
            loginOtpRepository.save(otp);
            return false;
        }
        otp.setConsumed(true);
        loginOtpRepository.save(otp);
        return true;
    }

    private void invalidateOutstandingLoginOtps(Long userId) {
        List<LoginOtp> outstanding = loginOtpRepository.findByUserIdAndConsumedFalse(userId);
        outstanding.forEach(o -> o.setConsumed(true));
        loginOtpRepository.saveAll(outstanding);
    }

    private String generateLoginOtp() {
        int number = secureRandom.nextInt(1_000_000);
        return String.format("%0" + LOGIN_OTP_LENGTH + "d", number);
    }

    @Override
    public void registerAdmin(AdminRegisterRequest request) {
        String email = request.getEmail().trim();
        String phone = request.getPhone().trim();
        String employeeId = request.getEmployeeId().trim();

        userRepository.findByEmail(email).ifPresent(existing -> {
            if ("admin".equalsIgnoreCase(existing.getUserType())) {
                throw new BusinessException("This email is already registered as an admin. Please log in instead.");
            }
            throw new BusinessException("This email is already associated with another account.");
        });

        if (adminRepository.existsByPhoneNumber(phone)) {
            throw new BusinessException("This phone number is already registered to an admin account.");
        }

        if (adminRepository.existsByEmployeeId(employeeId)) {
            throw new BusinessException("This Employee ID is already registered.");
        }

        String[] nameParts = request.getFullName().trim().split("\\s+", 2);
        String firstName = nameParts[0];
        String lastName = nameParts.length > 1 ? nameParts[1] : null;

        User user = new User();
        user.setFirstName(firstName);
        user.setLastName(lastName);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setUserType("admin");
        user.setIsActive(true);
        user.setIsEmailVerified(false);
        User savedUser = userRepository.save(user);

        Admin admin = new Admin();
        admin.setAdminId(savedUser.getId());
        admin.setPhoneNumber(phone);
        admin.setEmployeeId(employeeId);
        admin.setRole("moderator");
        admin.setStatus("active");
        adminRepository.save(admin);

        eventPublisher.publish(new UserRegisteredEvent(savedUser.getId()));
    }

    private String normalizeUserType(String userType) {
        if (userType == null || userType.isBlank()) {
            return null;
        }

        String normalized = userType.trim().toLowerCase();
        return switch (normalized) {
            case "passenger" -> "passenger";
            case "driver" -> "driver";
            case "admin" -> "admin";
            case "corporate", "corporate_user" -> "corporate";
            default -> normalized;
        };
    }

    private String toDisplayRole(String userType) {
        return switch (userType) {
            case "passenger" -> "Passenger";
            case "driver" -> "Driver";
            case "admin" -> "Admin";
            case "corporate" -> "Corporate";
            default -> userType;
        };
    }
}

