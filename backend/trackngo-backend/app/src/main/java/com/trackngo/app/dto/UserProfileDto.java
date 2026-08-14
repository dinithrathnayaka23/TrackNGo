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
        String userType
) {
}