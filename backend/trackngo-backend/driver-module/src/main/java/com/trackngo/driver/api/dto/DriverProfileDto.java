package com.trackngo.driver.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DriverProfileDto {
    private Long driverId;
    private String firstName;
    private String lastName;
    private String email;
    private String phoneNumber;
    private String profilePhoto;
    private String licenseNumber;
    private LocalDate licenceExpiry;
    private Integer yearsOfExperience;
    private LocalDate joinedDate;
    private String status;
    private Boolean isVerified;
    private BigDecimal averageRating;
    private BigDecimal driverEarnings;
    private String accountNumber;
    private Boolean isPhoneVerified;
}
