package com.trackngo.auth.internal.service.notify;

import com.trackngo.commons.exception.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

/**
 * Sends OTP emails via JavaMailSender.
 *
 * <p>OTP delivery is part of the security boundary: callers must not receive
 * a success response when a message was only written to a server log or could
 * not be delivered. Failures therefore propagate to the API client.
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
                "Password reset OTP");
    }

    public void sendLoginOtp(String toEmail, String otpCode, int expiryMinutes) {
        send(toEmail, "Your TrackNGo login verification code",
                "Your TrackNGo login verification code is: " + otpCode + "\n\n"
                        + "Enter this code to finish logging in. It expires in " + expiryMinutes
                        + " minutes. If you did not attempt to log in, you can safely ignore this email.",
                "Login OTP");
    }

    public void sendRegistrationOtp(String toEmail, String otpCode, int expiryMinutes) {
        send(toEmail, "Verify your email for TrackNGo",
                "Your TrackNGo verification code is: " + otpCode + "\n\n"
                        + "Enter this code in the app to finish creating your account. It expires in "
                        + expiryMinutes + " minutes. If you did not request this, you can safely ignore this email.",
                "Registration OTP");
    }

    private void send(String toEmail, String subject, String body, String logLabel) {
        if (!isConfigured()) {
            log.error("SMTP is not configured; refusing to report a successful {} email for {}.", logLabel, toEmail);
            throw new BusinessException("Email delivery is not configured. Please contact support.");
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
            log.error("Failed to send {} email to {}: {}", logLabel, toEmail, ex.getMessage());
            throw new BusinessException("We could not send the verification email. Please try again later.");
        }
    }

    private static boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
