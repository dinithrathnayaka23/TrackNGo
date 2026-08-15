package com.trackngo.auth.api.dto;

import java.time.LocalDateTime;
import java.math.BigDecimal;

/** Database-backed user summary used by the admin users table. */
public record AdminUserDto(
        Long id,
        String firstName,
        String lastName,
        String email,
        String phone,
        String userType,
        String status,
        Boolean emailVerified,
        String profilePhoto,
        LocalDateTime joinedAt,
        String licenseNumber,
        String assignedBus,
        Integer yearsOfExperience,
        Boolean driverVerified,
        BigDecimal driverRating,
        Long driverTrips,
        Long passengerBookings,
        String lastTripDate,
        String lastRoute,
        String companyName,
        String businessRegistrationNumber,
        String contactPersonName,
        String contactPersonDesignation,
        Long activeContracts,
        BigDecimal corporateRevenue
) {
}
