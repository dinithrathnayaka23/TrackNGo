package com.trackngo.app.dto;

public record UpdateUserProfileRequest(
        String fullName,
        String phoneNumber,
        String email,
        String profilePhoto
) {
}
