package com.trackngo.app.util;

import java.util.Locale;
import java.util.Set;

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
}
