package com.trackngo.app.util;

import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Rejects obviously-fake profile input ("test", "asdf", "1111", ...) so a
 * corporate account can't complete its profile — and unlock contract
 * requests — with placeholder text. Used by both the profile save path
 * ({@code CorporateProfileService}) and the contract-eligibility check
 * ({@code CorporateService.requireCompleteProfile}) so the two can't drift.
 */
public final class ProfileValidation {

    private static final Set<String> PLACEHOLDER_VALUES = Set.of(
            "test", "tests", "testing", "n/a", "na", "none", "asdf", "asdfgh",
            "xxx", "xxxx", "abc", "abcd", "sample", "demo", "example",
            "placeholder", "unknown", "company", "address"
    );

    private ProfileValidation() {
    }

    /** Throws with a user-facing message if the value fails {@link #isRealText}. */
    public static void requireRealText(String value, String fieldLabel, int minLength) {
        if (!isRealText(value, minLength)) {
            throw new IllegalArgumentException(
                    fieldLabel + " must be a real value of at least " + minLength + " characters, not placeholder text.");
        }
    }

    /**
     * True if the value is non-blank, at least {@code minLength} characters,
     * isn't a known placeholder word, and isn't a single character repeated
     * (e.g. "1111", "aaaa").
     */
    public static boolean isRealText(String value, int minLength) {
        if (value == null) {
            return false;
        }
        String trimmed = value.trim();
        if (trimmed.length() < minLength) {
            return false;
        }
        if (PLACEHOLDER_VALUES.contains(trimmed.toLowerCase(Locale.ROOT))) {
            return false;
        }
        return trimmed.chars().distinct().count() > 1;
    }

    /** Throws with a user-facing message if the value fails {@link #isValidPhone}. */
    public static void requireValidPhone(String value, String fieldLabel) {
        if (!isValidPhone(value)) {
            throw new IllegalArgumentException(fieldLabel + " must be a valid phone number.");
        }
    }

    /** True if the value has between 7 and 15 digits once formatting is stripped. */
    public static boolean isValidPhone(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }
        String digits = value.replaceAll("[^0-9]", "");
        return digits.length() >= 7 && digits.length() <= 15;
    }

    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    /** True for a plausible "local@domain.tld" shape — not a full RFC 5322 check, just enough to catch typos. */
    public static boolean isValidEmail(String value) {
        return value != null && EMAIL_PATTERN.matcher(value.trim()).matches();
    }

    /** Throws with a user-facing message if the value fails {@link #isValidEmail}. */
    public static void requireValidEmail(String value, String fieldLabel) {
        if (!isValidEmail(value)) {
            throw new IllegalArgumentException(fieldLabel + " must be a valid email address.");
        }
    }

    /**
     * True for a Sri Lankan landline or mobile number: a 9-digit subscriber
     * number (first digit 1-9) optionally prefixed with a trunk "0" or the
     * "+94"/"94" country code, e.g. "0771234567", "+94 77 123 4567" or
     * "94112345678".
     */
    public static boolean isValidSriLankanPhone(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }
        String digits = value.replaceAll("[^0-9]", "");
        String local = digits;
        if (local.startsWith("94") && local.length() == 11) {
            local = local.substring(2);
        } else if (local.startsWith("0") && local.length() == 10) {
            local = local.substring(1);
        }
        return local.matches("[1-9]\\d{8}");
    }

    /** Throws with a user-facing message if the value fails {@link #isValidSriLankanPhone}. */
    public static void requireValidSriLankanPhone(String value, String fieldLabel) {
        if (!isValidSriLankanPhone(value)) {
            throw new IllegalArgumentException(
                    fieldLabel + " must be a valid Sri Lankan phone number, e.g. +94 77 123 4567.");
        }
    }
}
