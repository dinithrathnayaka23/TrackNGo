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
        send(toEmail, "TrackNGo password reset code",
                "Your TrackNGo admin password reset code is: " + otpCode + "\n\n"
                        + "This code expires in " + expiryMinutes + " minutes. "
                        + "If you did not request this, you can safely ignore this email.",
                "Password reset OTP", otpCode, expiryMinutes);
    }

    public void sendRegistrationOtp(String toEmail, String otpCode, int expiryMinutes) {
        send(toEmail, "Verify your email for TrackNGo",
                "Your TrackNGo verification code is: " + otpCode + "\n\n"
                        + "Enter this code in the app to finish creating your account. It expires in "
                        + expiryMinutes + " minutes. If you did not request this, you can safely ignore this email.",
                "Registration OTP", otpCode, expiryMinutes);
    }

    private void send(String toEmail, String subject, String body, String logLabel, String otpCode, int expiryMinutes) {
        if (!isConfigured()) {
            log.warn("[DEV OTP] code {} for {} via EMAIL (expires in {} minutes) - SMTP not configured, logging instead of sending",
                    otpCode, toEmail, expiryMinutes);
            return;
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(toEmail);
            message.setSubject(subject);
            message.setText(body);
            mailSender.send(message);
            log.info("{} email sent to {}", logLabel, toEmail);
        } catch (Exception ex) {
            log.warn("Failed to send {} email to {}, falling back to console log: {}", logLabel, toEmail, ex.getMessage());
            log.warn("[DEV OTP] code {} for {} via EMAIL (expires in {} minutes)", otpCode, toEmail, expiryMinutes);
        }
    }

    private static boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
