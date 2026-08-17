package com.trackngo.auth.internal.service.notify;

import com.twilio.Twilio;
import com.twilio.exception.ApiException;
import com.twilio.rest.api.v2010.account.Message;
import com.twilio.type.PhoneNumber;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Sends the password-reset OTP by SMS via Twilio. This is a self-contained
 * copy of the phone-normalization/send logic used by sos-module's
 * TwilioSmsService (auth-user-module intentionally does not depend on
 * sos-module across module boundaries). Falls back to a console log when
 * Twilio isn't configured, so the flow is still testable locally.
 */
@Slf4j
@Component
public class OtpSmsSender {

    private final String accountSid;
    private final String authToken;
    private final String fromNumber;
    private final String messagingServiceSid;
    private final String defaultCountryCode;

    public OtpSmsSender(
            @Value("${twilio.account-sid:}") String accountSid,
            @Value("${twilio.auth-token:}") String authToken,
            @Value("${twilio.phone-number:}") String fromNumber,
            @Value("${twilio.messaging-service-sid:}") String messagingServiceSid,
            @Value("${twilio.default-country-code:+94}") String defaultCountryCode) {
        this.accountSid = accountSid;
        this.authToken = authToken;
        this.fromNumber = fromNumber;
        this.messagingServiceSid = messagingServiceSid;
        this.defaultCountryCode = defaultCountryCode;
    }

    public boolean isConfigured() {
        return hasText(accountSid)
                && hasText(authToken)
                && (hasText(messagingServiceSid) || hasText(fromNumber));
    }

    public void sendOtp(String toNumber, String otpCode, int expiryMinutes) {
        String message = "Your TrackNGo admin password reset code is " + otpCode
                + ". It expires in " + expiryMinutes + " minutes.";

        if (!isConfigured()) {
            log.warn("[DEV OTP] code {} for {} via PHONE (expires in {} minutes) - Twilio not configured, logging instead of sending",
                    otpCode, toNumber, expiryMinutes);
            return;
        }

        String normalizedToNumber = normalizePhoneNumber(toNumber, defaultCountryCode);
        if (!hasText(normalizedToNumber)) {
            log.warn("[DEV OTP] code {} for {} via PHONE - invalid destination number, logging instead of sending",
                    otpCode, toNumber);
            return;
        }

        try {
            Twilio.init(accountSid, authToken);
            Message twilioMessage;

            if (hasText(messagingServiceSid)) {
                twilioMessage = Message.creator(
                        new PhoneNumber(normalizedToNumber),
                        messagingServiceSid,
                        message
                ).create();
            } else {
                String normalizedFromNumber = normalizePhoneNumber(fromNumber, null);
                twilioMessage = Message.creator(
                        new PhoneNumber(normalizedToNumber),
                        new PhoneNumber(normalizedFromNumber),
                        message
                ).create();
            }

            log.info("Twilio OTP SMS accepted. sid={}, to={}, status={}",
                    twilioMessage.getSid(), normalizedToNumber, twilioMessage.getStatus());
        } catch (ApiException ex) {
            log.warn("Twilio API call failed ({}), falling back to console log: {}", ex.getCode(), ex.getMessage());
            log.warn("[DEV OTP] code {} for {} via PHONE (expires in {} minutes)", otpCode, toNumber, expiryMinutes);
        } catch (Exception ex) {
            log.warn("Failed to send OTP SMS to {}, falling back to console log: {}", toNumber, ex.getMessage());
            log.warn("[DEV OTP] code {} for {} via PHONE (expires in {} minutes)", otpCode, toNumber, expiryMinutes);
        }
    }

    private static String normalizePhoneNumber(String raw, String defaultCountryCode) {
        if (!hasText(raw)) {
            return null;
        }

        String trimmed = raw.trim();
        String cleaned = trimmed.replaceAll("[^0-9+]", "");

        if (cleaned.startsWith("00")) {
            return "+" + cleaned.substring(2);
        }

        if (cleaned.startsWith("+")) {
            return cleaned;
        }

        String digitsOnly = cleaned.replaceAll("[^0-9]", "");
        if (!hasText(digitsOnly)) {
            return null;
        }

        if (hasText(defaultCountryCode)) {
            String country = defaultCountryCode.startsWith("+") ? defaultCountryCode : "+" + defaultCountryCode;
            if (digitsOnly.startsWith("0")) {
                return country + digitsOnly.substring(1);
            }
            return country + digitsOnly;
        }

        return digitsOnly;
    }

    private static boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
