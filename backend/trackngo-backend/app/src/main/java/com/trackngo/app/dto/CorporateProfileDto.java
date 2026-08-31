package com.trackngo.app.dto;

public record CorporateProfileDto(
        String companyName,
        String businessRegistrationNumber,
        String industry,
        String address,
        String website,
        Integer employeeCount,
        String contactPersonName,
        String contactPersonDesignation,
        String contactPhone,
        String contactEmail,
        String profilePhoto
) {
}
