package com.trackngo.driver.internal.entity;

import jakarta.persistence.*; //jpa
import lombok.AllArgsConstructor;
import lombok.Data; //is used for getters and setters
import lombok.NoArgsConstructor;

import java.math.BigDecimal; // used for decimals
import java.time.LocalDate;

@Entity //this class is a db entity (jpa annonations)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "driver") // db conn
public class Driver { //db table structure
    @Id //pk
    @Column(name = "driver_id") //db column name (driver.getDriverId() done by @Data)
    private Long driverId;

    @Column(name = "licence_expiry")
    private LocalDate licenceExpiry;

    @Column(name = "years_of_experience")
    private Integer yearsOfExperience;

    @Column(name = "profile_photo")
    private String profilePhoto;

    @Column(name = "account_number")
    private String accountNumber;

    @Column(name = "bank_name")
    private String bankName;

    @Column(name = "phone_number", unique = true) //no duplicates
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
