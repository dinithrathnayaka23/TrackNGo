package com.trackngo.auth.internal.service;

import com.trackngo.auth.api.PasswordResetService;
import com.trackngo.auth.api.dto.ForgotPasswordRequest;
import com.trackngo.auth.api.dto.ForgotPasswordResponse;
import com.trackngo.auth.api.dto.ResendOtpRequest;
import com.trackngo.auth.api.dto.ResetPasswordRequest;
import com.trackngo.auth.api.dto.VerifyOtpRequest;
import com.trackngo.auth.api.dto.VerifyOtpResponse;
import com.trackngo.auth.internal.entity.PasswordResetOtp;
import com.trackngo.auth.internal.entity.User;
import com.trackngo.auth.internal.repository.PasswordResetOtpRepository;
import com.trackngo.auth.internal.repository.UserRepository;
import com.trackngo.auth.internal.service.notify.OtpEmailSender;
import com.trackngo.auth.internal.service.notify.OtpSmsSender;
import com.trackngo.commons.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PasswordResetServiceImpl implements PasswordResetService {

    private static final int OTP_LENGTH = 6;
    private static final long OTP_EXPIRY_MINUTES = 5;
    private static final long RESET_TOKEN_EXPIRY_MINUTES = 10;
    private static final long RESEND_COOLDOWN_SECONDS = 30;
    private static final int MAX_ATTEMPTS = 5;

    private static final String CHANNEL_EMAIL = "EMAIL";
    private static final String CHANNEL_PHONE = "PHONE";

    private final UserRepository userRepository;
    private final PasswordResetOtpRepository otpRepository;
    private final PasswordEncoder passwordEncoder;
    private final OtpEmailSender otpEmailSender;
    private final OtpSmsSender otpSmsSender;

    private final SecureRandom secureRandom = new SecureRandom();

    @Override
    @Transactional
    public ForgotPasswordResponse forgotPassword(ForgotPasswordRequest request) {
        User user = userRepository.findByIdentifier(request.getIdentifier().trim())
                .orElseThrow(() -> new BusinessException("No account found for this identifier"));

        requireUserType(user, request.getExpectedUserType());

        String channel = normalizeChannel(request.getChannel());
        String destination = resolveDestination(user, channel);

        invalidateOutstandingOtps(user.getId());

        return createAndSendOtp(user.getId(), channel, destination);
    }

    @Override
    @Transactional
    public ForgotPasswordResponse resendOtp(ResendOtpRequest request) {
        User user = userRepository.findByIdentifier(request.getIdentifier().trim())
                .orElseThrow(() -> new BusinessException("No account found for this identifier"));

        PasswordResetOtp last = otpRepository.findTopByUserIdAndConsumedFalseOrderByCreatedAtDesc(user.getId())
                .orElseThrow(() -> new BusinessException("No pending password reset request found. Please start again."));

        long secondsSinceLastSend = ChronoUnit.SECONDS.between(last.getLastSentAt(), LocalDateTime.now());
        if (secondsSinceLastSend < RESEND_COOLDOWN_SECONDS) {
            long remaining = RESEND_COOLDOWN_SECONDS - secondsSinceLastSend;
            throw new BusinessException("Please wait " + remaining + " more second(s) before requesting a new code");
        }

        String channel = last.getChannel();
        String destination = last.getDestination();

        invalidateOutstandingOtps(user.getId());

        return createAndSendOtp(user.getId(), channel, destination);
    }

    @Override
    @Transactional
    public VerifyOtpResponse verifyOtp(VerifyOtpRequest request) {
        User user = userRepository.findByIdentifier(request.getIdentifier().trim())
                .orElseThrow(() -> new BusinessException("No account found for this identifier"));

        PasswordResetOtp otp = otpRepository.findTopByUserIdAndConsumedFalseOrderByCreatedAtDesc(user.getId())
                .orElseThrow(() -> new BusinessException("No pending password reset request found. Please start again."));

        if (otp.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new BusinessException("This code has expired. Please request a new one.");
        }

        if (otp.getAttempts() >= MAX_ATTEMPTS) {
            throw new BusinessException("Too many incorrect attempts. Please request a new code.");
        }

        if (!passwordEncoder.matches(request.getOtp().trim(), otp.getOtpHash())) {
            otp.setAttempts(otp.getAttempts() + 1);
            otpRepository.save(otp);
            if (otp.getAttempts() >= MAX_ATTEMPTS) {
                throw new BusinessException("Too many incorrect attempts. Please request a new code.");
            }
            throw new BusinessException("Invalid code.");
        }

        String resetToken = UUID.randomUUID().toString();
        otp.setResetToken(resetToken);
        otp.setVerifiedAt(LocalDateTime.now());
        otp.setExpiresAt(LocalDateTime.now().plusMinutes(RESET_TOKEN_EXPIRY_MINUTES));
        otpRepository.save(otp);

        return new VerifyOtpResponse(resetToken, RESET_TOKEN_EXPIRY_MINUTES * 60);
    }

    @Override
    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        PasswordResetOtp otp = otpRepository.findByResetTokenAndConsumedFalse(request.getResetToken())
                .orElseThrow(() -> new BusinessException("Invalid or expired reset request. Please start again."));

        if (otp.getVerifiedAt() == null) {
            throw new BusinessException("This code has not been verified yet.");
        }

        if (otp.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new BusinessException("This reset link has expired. Please start again.");
        }

        User user = userRepository.findById(otp.getUserId())
                .orElseThrow(() -> new BusinessException("Account no longer exists"));

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        otp.setConsumed(true);
        otpRepository.save(otp);
    }

    private ForgotPasswordResponse createAndSendOtp(Long userId, String channel, String destination) {
        String otpCode = generateOtp();
        LocalDateTime now = LocalDateTime.now();

        PasswordResetOtp otp = new PasswordResetOtp();
        otp.setUserId(userId);
        otp.setChannel(channel);
        otp.setDestination(destination);
        otp.setOtpHash(passwordEncoder.encode(otpCode));
        otp.setExpiresAt(now.plusMinutes(OTP_EXPIRY_MINUTES));
        otp.setConsumed(false);
        otp.setAttempts(0);
        otp.setLastSentAt(now);
        otp.setCreatedAt(now);
        otpRepository.save(otp);

        if (CHANNEL_EMAIL.equals(channel)) {
            otpEmailSender.sendOtp(destination, otpCode, (int) OTP_EXPIRY_MINUTES);
        } else {
            otpSmsSender.sendOtp(destination, otpCode, (int) OTP_EXPIRY_MINUTES);
        }

        return new ForgotPasswordResponse(
                maskDestination(channel, destination),
                channel,
                OTP_EXPIRY_MINUTES * 60,
                RESEND_COOLDOWN_SECONDS
        );
    }

    private void invalidateOutstandingOtps(Long userId) {
        List<PasswordResetOtp> outstanding = otpRepository.findByUserIdAndConsumedFalse(userId);
        outstanding.forEach(o -> o.setConsumed(true));
        otpRepository.saveAll(outstanding);
    }

    private String resolveDestination(User user, String channel) {
        if (CHANNEL_EMAIL.equals(channel)) {
            if (user.getEmail() == null || user.getEmail().isBlank()) {
                throw new BusinessException("No email address is on file for this account");
            }
            return user.getEmail();
        }

        return userRepository.findContactPhoneByUserId(user.getId())
                .filter(phone -> phone != null && !phone.isBlank())
                .orElseThrow(() -> new BusinessException("No phone number is on file for this account"));
    }

    private void requireUserType(User user, String expectedUserType) {
        if (expectedUserType == null || expectedUserType.isBlank()) {
            return;
        }
        String expected = expectedUserType.trim().toLowerCase();
        String actual = user.getUserType() == null ? "" : user.getUserType().trim().toLowerCase();
        if (!expected.equals(actual)) {
            throw new BusinessException("No " + expected + " account found for this identifier");
        }
    }

    private String normalizeChannel(String channel) {
        if (channel == null) {
            throw new BusinessException("Channel must be EMAIL or PHONE");
        }
        String normalized = channel.trim().toUpperCase();
        if (!CHANNEL_EMAIL.equals(normalized) && !CHANNEL_PHONE.equals(normalized)) {
            throw new BusinessException("Channel must be EMAIL or PHONE");
        }
        return normalized;
    }

    private String generateOtp() {
        int number = secureRandom.nextInt(1_000_000);
        return String.format("%0" + OTP_LENGTH + "d", number);
    }

    private String maskDestination(String channel, String destination) {
        if (CHANNEL_EMAIL.equals(channel)) {
            int at = destination.indexOf('@');
            if (at <= 1) {
                return "***" + destination.substring(Math.max(at, 0));
            }
            String local = destination.substring(0, at);
            String domain = destination.substring(at);
            String visible = local.substring(0, Math.min(1, local.length()));
            return visible + "***" + domain;
        }

        // Phone: keep last 2-4 visible digits.
        String digits = destination.replaceAll("[^0-9]", "");
        int visibleCount = digits.length() >= 4 ? 4 : Math.min(2, digits.length());
        String visibleTail = digits.length() >= visibleCount ? digits.substring(digits.length() - visibleCount) : digits;
        String prefix = destination.startsWith("+") ? destination.substring(0, Math.min(4, destination.length())) : "+";
        return prefix + "***" + visibleTail;
    }
}
