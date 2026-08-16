package com.trackngo.app.dto;

public record UpdateUserSettingsRequest(
        String language,
        Boolean shareLocation,
        Boolean twoFactorAuthentication,
        Boolean pushNotifications,
        Boolean smsAlerts,
        Boolean emailUpdates,
        Boolean bookingUpdates
) {
}
