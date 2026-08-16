
package com.trackngo.auth.internal.service;

import com.trackngo.auth.api.AuthService;
import com.trackngo.auth.api.dto.AuthRequest;
import com.trackngo.auth.api.dto.AuthResponse;
import com.trackngo.auth.api.dto.TwoFactorVerifyRequest;
import com.trackngo.auth.events.UserRegisteredEvent;
import com.trackngo.auth.internal.entity.User;
import com.trackngo.auth.internal.repository.UserRepository;
import com.trackngo.commons.events.EventPublisher;
import com.trackngo.commons.exception.BusinessException;
import com.trackngo.commons.util.JwtUtil; // import JwtUtil
import com.trackngo.commons.security.TotpUtil;
import com.trackngo.commons.security.TrustedDeviceService;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final EventPublisher eventPublisher;
    private final JdbcTemplate jdbcTemplate;
    private final TrustedDeviceService trustedDeviceService;

    @Override
    public AuthResponse login(AuthRequest request) {
        User user = userRepository.findByIdentifier(request.getIdentifier().trim())
            .orElseThrow(() -> new BusinessException("Invalid credentials"));
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new BusinessException("Invalid credentials");
        }
        if (Boolean.FALSE.equals(user.getIsActive())) {
            throw new BusinessException("Account is inactive.");
        }

        String requestedUserType = normalizeUserType(request.getExpectedUserType());
        String actualUserType = normalizeUserType(user.getUserType());

        if (requestedUserType != null && !requestedUserType.equals(actualUserType)) {
            throw new BusinessException("Access denied. " + toDisplayRole(requestedUserType) + " account required.");
        }

        if (isTwoFactorEnabled(user.getId())
                && !trustedDeviceService.isTrusted(user.getId(), request.getTrustedDeviceToken())) {
            String challengeToken = jwtUtil.generateToken(
                    user.getEmail(),
                    Map.of("purpose", "2fa", "userId", user.getId(), "role", actualUserType, "userType", actualUserType),
                    5 * 60 * 1000L
            );
            return new AuthResponse(null, user.getId(), user.getUserType(), user.getEmail(), user.getFirstName(), user.getLastName(), true, challengeToken, null);
        }
        return authenticatedResponse(user, null);
    }


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
            throw new BusinessException("The authenticator code is invalid or expired.");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException("Invalid two-factor challenge."));
        return authenticatedResponse(user, trustedDeviceService.issue(user.getId()));
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

    private boolean verifyCode(Long userId, String code) {
        try {
            Map<String, Object> settings = jdbcTemplate.queryForMap(
                    "SELECT two_factor_authentication, two_factor_secret FROM user_settings WHERE user_id = ?",
                    userId
            );
            return Boolean.TRUE.equals(settings.get("two_factor_authentication"))
                    && TotpUtil.isValidCode((String) settings.get("two_factor_secret"), code);
        } catch (DataAccessException ex) {
            return false;
        }
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

