package com.trackngo.driver.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal; // for decimal
import java.time.LocalDate;  // for date

@Data // generate getter and setter automatically to get and set data below
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
    private LocalDate licenceExpiry; //no time or zon, just the date
    private Integer yearsOfExperience;
    private LocalDate joinedDate;
    private String status;
    private Boolean isVerified;
    private BigDecimal averageRating; //more accurate than double becoze of precision
    private BigDecimal driverEarnings; 
    private String accountNumber;
    private String bankName;
    private Boolean isPhoneVerified;
}
