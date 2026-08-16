package com.trackngo.app.dto;

public record UserSettingsDto(
        Long userId,
        String language,
        boolean shareLocation,
        boolean twoFactorAuthentication,
        boolean pushNotifications,
        boolean smsAlerts,
        boolean emailUpdates,
        boolean bookingUpdates
) {
}
