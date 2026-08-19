package com.trackngo.auth.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Complete database-backed driver record exposed to administrators. */
public record AdminDriverDto(
        Long id,
        String firstName,
        String lastName,
        String email,
        String phoneNumber,
        String profilePhoto,
        String licenseNumber,
        LocalDate licenceExpiry,
        Integer yearsOfExperience,
        String accountNumber,
        String bankName,
        String status,
        Boolean isVerified,
        Boolean isPhoneVerified,
        LocalDate joinedDate,
        BigDecimal driverEarnings,
        BigDecimal averageRating,
        Long driverTrips,
        Long assignedBusId,
        String assignedBus
) {
}
