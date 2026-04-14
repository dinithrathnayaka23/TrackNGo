package com.trackngo.sos.internal.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@Service
public class AndroidSmsGatewayService implements SmsProvider {

    private static final Logger log = LoggerFactory.getLogger(AndroidSmsGatewayService.class);

    private final String gatewayUrl;
    private final String apiKey;
    private final String defaultCountryCode;
    private final RestTemplate restTemplate;

    public AndroidSmsGatewayService(
            @Value("${sms.android-gateway.url:}") String gatewayUrl,
            @Value("${sms.android-gateway.api-key:}") String apiKey,
            @Value("${twilio.default-country-code:+94}") String defaultCountryCode) {
        this.gatewayUrl = gatewayUrl;
        this.apiKey = apiKey;
        this.defaultCountryCode = defaultCountryCode;
        this.restTemplate = new RestTemplate();
    }

    @Override
    public boolean isConfigured() {
        return hasText(gatewayUrl);
    }

    @Override
    public String getProviderName() {
        return "android-gateway";
    }

    @Override
    public void sendSms(String toNumber, String message) {
        if (!isConfigured()) {
            throw new IllegalStateException("Android SMS Gateway is not configured (gateway URL required)");
        }

        String normalizedNumber = normalizePhoneNumber(toNumber, defaultCountryCode);
        if (!hasText(normalizedNumber)) {
            throw new IllegalArgumentException("Invalid destination number");
        }

        if (!hasText(message)) {
            throw new IllegalArgumentException("SMS message is empty");
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            if (hasText(apiKey)) {
                headers.set("Authorization", "Bearer " + apiKey);
            }

            Map<String, Object> body = Map.of(
                "phoneNumbers", List.of(normalizedNumber),
                "message", message
            );

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

            String sendUrl = gatewayUrl.endsWith("/")
                ? gatewayUrl + "message"
                : gatewayUrl + "/message";

            ResponseEntity<String> response = restTemplate.exchange(
                sendUrl,
                HttpMethod.POST,
                request,
                String.class
            );

            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Android SMS Gateway accepted message to {}: {}", normalizedNumber, response.getBody());
            } else {
                throw new IllegalStateException(
                    "Android SMS Gateway returned status " + response.getStatusCode()
                        + ": " + response.getBody()
                );
            }
        } catch (IllegalStateException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalStateException(
                "Android SMS Gateway call failed: " + ex.getMessage(), ex
            );
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
            String country = defaultCountryCode.startsWith("+")
                ? defaultCountryCode
                : "+" + defaultCountryCode;

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
