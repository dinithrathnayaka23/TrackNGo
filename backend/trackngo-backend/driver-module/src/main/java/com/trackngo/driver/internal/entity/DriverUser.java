package com.trackngo.driver.internal.entity;

import jakarta.persistence.*; //jpa coming from jakarta package
import lombok.AllArgsConstructor;
import lombok.Data; //is used for getters and setters to access fields
import lombok.NoArgsConstructor;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "user")
public class DriverUser {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY) //means auto increment and primary key
    @Column(name = "user_id")
    private Long id;

    @Column(name = "first_name")
    private String firstName;

    @Column(name = "last_name")
    private String lastName;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(name = "user_type")
    private String userType;

    @Column(name = "is_email_verified")
    private Boolean isEmailVerified;

    @Column(name = "is_active")
    private Boolean isActive;

    @Column(name = "last_login")
    private String lastLogin;

    @Column(name = "language_preference")
    private String languagePreference;

    @Column(name = "theme_preference")
    private String themePreference;
}
