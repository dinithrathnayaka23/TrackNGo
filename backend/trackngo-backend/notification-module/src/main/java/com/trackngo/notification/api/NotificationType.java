package com.trackngo.notification.api;

import java.util.Locale;

/**
 * The notification categories the database column accepts.
 *
 * The `notification.notification_type` column is a MySQL ENUM, so a value
 * outside this list is rejected at insert time. Producers use this enum instead
 * of raw strings to keep that constraint visible at compile time.
 */
public enum NotificationType {
    BOOKING,
    JOURNEY,
    PAYMENT,
    CANCELLATION,
    RATING,
    COMPLAINT,
    PROMOTION,
    SYSTEM_ALERT,
    SOS;

    /** Returns the lowercase key stored in the database and sent to the apps. */
    public String key() {
        return name().toLowerCase(Locale.ROOT);
    }
}
