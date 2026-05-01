package com.trackngo.driver.internal.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "driver")
public class Driver {
    @Id
    @Column(name = "driver_id")
    private Long driverId;

    @Column(name = "licence_expiry")
    private LocalDate licenceExpiry;

    @Column(name = "years_of_experience")
    private Integer yearsOfExperience;

    @Column(name = "profile_photo")
    private String profilePhoto;

    @Column(name = "account_number")
    private String accountNumber;

    @Column(name = "phone_number", unique = true)
    private String phoneNumber;

    @Column(name = "is_phone_verified")
    private Boolean isPhoneVerified;

    @Column(name = "license_number", unique = true)
    private String licenseNumber;

    @Column(name = "driver_earnings")
    private BigDecimal driverEarnings;

    @Column(name = "status")
    private String status;

    @Column(name = "is_verified")
    private Boolean isVerified;

    @Column(name = "average_rating")
    private BigDecimal averageRating;

    @Column(name = "joined_date")
    private LocalDate joinedDate;
}
