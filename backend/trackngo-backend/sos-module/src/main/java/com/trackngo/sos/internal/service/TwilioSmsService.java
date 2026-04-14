package com.trackngo.sos.internal.service;

import com.twilio.Twilio;
import com.twilio.exception.ApiException;
import com.twilio.rest.api.v2010.account.Message;
import com.twilio.type.PhoneNumber;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class TwilioSmsService implements SmsProvider {

    private static final Logger log = LoggerFactory.getLogger(TwilioSmsService.class);

    private final String accountSid;
    private final String authToken;
    private final String fromNumber;
    private final String messagingServiceSid;
    private final String defaultCountryCode;

    public TwilioSmsService(
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

    @Override
    public String getProviderName() {
        return "twilio";
    }

    public void sendSms(String toNumber, String message) {
        if (!isConfigured()) {
            throw new IllegalStateException("Twilio SMS is not configured (account/auth and sender info required)");
        }

        String normalizedToNumber = normalizePhoneNumber(toNumber, defaultCountryCode);
        if (!hasText(normalizedToNumber)) {
            throw new IllegalArgumentException("Invalid destination number");
        }

        if (!hasText(message)) {
            throw new IllegalArgumentException("SMS message is empty");
        }

        Twilio.init(accountSid, authToken);

        try {
            Message twilioMessage;

            if (hasText(messagingServiceSid)) {
                twilioMessage = Message.creator(
                    new PhoneNumber(normalizedToNumber),
                    messagingServiceSid,
                    message
                ).create();
            } else {
                String normalizedFromNumber = normalizePhoneNumber(fromNumber, null);
                if (!hasText(normalizedFromNumber)) {
                    throw new IllegalStateException("Twilio phone number is invalid");
                }

                twilioMessage = Message.creator(
                    new PhoneNumber(normalizedToNumber),
                    new PhoneNumber(normalizedFromNumber),
                    message
                ).create();
            }

            log.info(
                "Twilio SMS accepted. sid={}, to={}, status={}",
                twilioMessage.getSid(),
                normalizedToNumber,
                twilioMessage.getStatus()
            );
        } catch (ApiException ex) {
            String hint = buildHintForTwilioError(ex.getCode());
            throw new IllegalStateException(
                "Twilio API call failed: "
                    + ex.getMessage()
                    + " (code=" + ex.getCode() + ")"
                    + (hint != null ? " - " + hint : ""),
                ex
            );
        }
    }

    private static String buildHintForTwilioError(Integer code) {
        if (code == null) {
            return null;
        }

        if (code == 21608) {
            return "Twilio trial account can only send to verified recipient numbers";
        }
        if (code == 21408) {
            return "Geo permissions for destination country may be disabled";
        }
        if (code == 21614) {
            return "Destination number is invalid or not mobile-capable";
        }

        return null;
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
            String country = defaultCountryCode.startsWith("+")
                ? defaultCountryCode
                : "+" + defaultCountryCode;

            if (digitsOnly.startsWith("0")) {
                String converted = country + digitsOnly.substring(1);
                log.info("Converted local phone '{}' to E.164 '{}'", raw, converted);
                return converted;
            }

            String converted = country + digitsOnly;
            log.info("Converted local phone '{}' to E.164 '{}'", raw, converted);
            return converted;
        }

        log.warn("Phone number '{}' is not in E.164 format and no default country code configured", raw);
        return digitsOnly;
    }

    private static boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
