
package com.trackngo.auth.internal.service;

import com.trackngo.auth.api.RegistrationOtpService;
import com.trackngo.auth.api.dto.RegistrationOtpResponse;
import com.trackngo.auth.api.dto.ResendRegistrationOtpRequest;
import com.trackngo.auth.api.dto.SendRegistrationOtpRequest;
import com.trackngo.auth.api.dto.VerifyRegistrationOtpRequest;
import com.trackngo.auth.api.dto.VerifyRegistrationOtpResponse;
import com.trackngo.auth.internal.entity.RegistrationOtp;
import com.trackngo.auth.internal.repository.RegistrationOtpRepository;
import com.trackngo.auth.internal.repository.UserRepository;
import com.trackngo.auth.internal.service.notify.OtpEmailSender;
import com.trackngo.commons.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RegistrationOtpServiceImpl implements RegistrationOtpService {

    private static final int OTP_LENGTH = 6;
    private static final long OTP_EXPIRY_MINUTES = 5;
    private static final long VERIFICATION_TOKEN_EXPIRY_MINUTES = 15;
    private static final long RESEND_COOLDOWN_SECONDS = 30;
    private static final int MAX_ATTEMPTS = 5;

    private final RegistrationOtpRepository otpRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final OtpEmailSender otpEmailSender;

    private final SecureRandom secureRandom = new SecureRandom();

    @Override
    @Transactional
    public RegistrationOtpResponse sendOtp(SendRegistrationOtpRequest request) {
        String email = normalizeEmail(request.getEmail());
        if (userRepository.existsByEmail(email)) {
            throw new BusinessException("An account with this email already exists. Please log in instead.");
        }

        invalidateOutstanding(email);
        return createAndSendOtp(email);
    }

    @Override
    @Transactional
    public RegistrationOtpResponse resendOtp(ResendRegistrationOtpRequest request) {
        String email = normalizeEmail(request.getEmail());
        RegistrationOtp last = otpRepository.findTopByEmailAndConsumedFalseOrderByCreatedAtDesc(email)
                .orElseThrow(() -> new BusinessException("No pending verification request found. Please start again."));

        long secondsSinceLastSend = ChronoUnit.SECONDS.between(last.getLastSentAt(), LocalDateTime.now());
        if (secondsSinceLastSend < RESEND_COOLDOWN_SECONDS) {
            long remaining = RESEND_COOLDOWN_SECONDS - secondsSinceLastSend;
            throw new BusinessException("Please wait " + remaining + " more second(s) before requesting a new code");
        }

        invalidateOutstanding(email);
        return createAndSendOtp(email);
    }

    @Override
    @Transactional
    public VerifyRegistrationOtpResponse verifyOtp(VerifyRegistrationOtpRequest request) {
        String email = normalizeEmail(request.getEmail());
        RegistrationOtp otp = otpRepository.findTopByEmailAndConsumedFalseOrderByCreatedAtDesc(email)
                .orElseThrow(() -> new BusinessException("No pending verification request found. Please start again."));

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

        String verificationToken = UUID.randomUUID().toString();
        otp.setVerificationToken(verificationToken);
        otp.setVerifiedAt(LocalDateTime.now());
        otp.setExpiresAt(LocalDateTime.now().plusMinutes(VERIFICATION_TOKEN_EXPIRY_MINUTES));
        otpRepository.save(otp);

        return new VerifyRegistrationOtpResponse(verificationToken, VERIFICATION_TOKEN_EXPIRY_MINUTES * 60);
    }

    @Override
    @Transactional
    public void consumeVerificationToken(String email, String verificationToken) {
        if (verificationToken == null || verificationToken.isBlank()) {
            throw new BusinessException("Please verify your email before creating an account.");
        }

        RegistrationOtp otp = otpRepository.findByVerificationTokenAndConsumedFalse(verificationToken.trim())
                .orElseThrow(() -> new BusinessException("Email verification has expired. Please verify again."));

        if (!otp.getEmail().equalsIgnoreCase(normalizeEmail(email))) {
            throw new BusinessException("Email verification does not match this account.");
        }
        if (otp.getVerifiedAt() == null) {
            throw new BusinessException("Please verify your email before creating an account.");
        }
        if (otp.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new BusinessException("Email verification has expired. Please verify again.");
        }

        otp.setConsumed(true);
        otpRepository.save(otp);
    }

    private RegistrationOtpResponse createAndSendOtp(String email) {
        String otpCode = generateOtp();
        LocalDateTime now = LocalDateTime.now();

        RegistrationOtp otp = new RegistrationOtp();
        otp.setEmail(email);
        otp.setOtpHash(passwordEncoder.encode(otpCode));
        otp.setExpiresAt(now.plusMinutes(OTP_EXPIRY_MINUTES));
        otp.setConsumed(false);
        otp.setAttempts(0);
        otp.setLastSentAt(now);
        otp.setCreatedAt(now);
        otpRepository.save(otp);

        otpEmailSender.sendRegistrationOtp(email, otpCode, (int) OTP_EXPIRY_MINUTES);

        return new RegistrationOtpResponse(maskEmail(email), OTP_EXPIRY_MINUTES * 60, RESEND_COOLDOWN_SECONDS);
    }

    private void invalidateOutstanding(String email) {
        List<RegistrationOtp> outstanding = otpRepository.findByEmailAndConsumedFalse(email);
        outstanding.forEach(o -> o.setConsumed(true));
        otpRepository.saveAll(outstanding);
    }

    private String normalizeEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new BusinessException("Email is required");
        }
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private String generateOtp() {
        int number = secureRandom.nextInt(1_000_000);
        return String.format("%0" + OTP_LENGTH + "d", number);
    }

    private String maskEmail(String email) {
        int at = email.indexOf('@');
        if (at <= 1) {
            return "***" + email.substring(Math.max(at, 0));
        }
        String local = email.substring(0, at);
        String domain = email.substring(at);
        String visible = local.substring(0, Math.min(1, local.length()));
        return visible + "***" + domain;
    }
}
