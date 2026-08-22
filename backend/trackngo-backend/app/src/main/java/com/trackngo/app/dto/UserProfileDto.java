package com.trackngo.app.dto;

public record UserProfileDto(
        Long userId,
        String fullName,
        String phoneNumber,
        String email,
        String profilePhoto,
        String companyName,
        String contactPersonName,
        String contactPhone,
        String contactPersonDesignation,
        String address,
        String businessRegistrationNumber,
        String industry,
        String userType,
        String token
) {
    public UserProfileDto(
            Long userId,
            String fullName,
            String phoneNumber,
            String email,
            String profilePhoto,
            String companyName,
            String contactPersonName,
            String contactPhone,
            String contactPersonDesignation,
            String address,
            String businessRegistrationNumber,
            String industry,
            String userType
    ) {
        this(userId, fullName, phoneNumber, email, profilePhoto, companyName, contactPersonName,
                contactPhone, contactPersonDesignation, address, businessRegistrationNumber, industry, userType, null);
    }

    /**
     * A JWT is issued keyed to the user's email; changing the email invalidates
     * that token server-side (loadUserByUsername can no longer find it), so the
     * caller must be handed a fresh token to keep their session alive.
     */
    public UserProfileDto withToken(String newToken) {
        return new UserProfileDto(userId, fullName, phoneNumber, email, profilePhoto, companyName,
                contactPersonName, contactPhone, contactPersonDesignation, address,
                businessRegistrationNumber, industry, userType, newToken);
    }
}