package com.trackngo.auth.internal.service.notify;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

/**
 * Sends the password-reset OTP by email via JavaMailSender.
 * Falls back to a console log when SMTP isn't configured, so the flow is
 * still testable locally without real credentials.
 */
@Slf4j
@Component
public class OtpEmailSender {

    private final JavaMailSender mailSender;
    private final String mailHost;
    private final String fromAddress;

    public OtpEmailSender(
            JavaMailSender mailSender,
            @Value("${spring.mail.host:}") String mailHost,
            @Value("${spring.mail.from:no-reply@trackngo.local}") String fromAddress) {
        this.mailSender = mailSender;
        this.mailHost = mailHost;
        this.fromAddress = fromAddress;
    }

    public boolean isConfigured() {
        return hasText(mailHost);
    }

    public void sendOtp(String toEmail, String otpCode, int expiryMinutes) {
        if (!isConfigured()) {
            log.warn("[DEV OTP] code {} for {} via EMAIL (expires in {} minutes) - SMTP not configured, logging instead of sending",
                    otpCode, toEmail, expiryMinutes);
            return;
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(toEmail);
            message.setSubject("TrackNGo password reset code");
            message.setText(
                    "Your TrackNGo admin password reset code is: " + otpCode + "\n\n"
                            + "This code expires in " + expiryMinutes + " minutes. "
                            + "If you did not request this, you can safely ignore this email.");
            mailSender.send(message);
            log.info("Password reset OTP email sent to {}", toEmail);
        } catch (Exception ex) {
            log.warn("Failed to send OTP email to {}, falling back to console log: {}", toEmail, ex.getMessage());
            log.warn("[DEV OTP] code {} for {} via EMAIL (expires in {} minutes)", otpCode, toEmail, expiryMinutes);
        }
    }

    private static boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
