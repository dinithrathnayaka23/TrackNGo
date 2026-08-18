package com.trackngo.auth.api.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/** Fields administrators may set when creating or updating a driver. */
public record SaveDriverRequest(
        @NotBlank(message = "First name is required")
        @Size(max = 80, message = "First name must be 80 characters or fewer")
        @Pattern(regexp = "^$|^[\\p{L}][\\p{L} .'-]*$", message = "First name contains invalid characters")
        String firstName,
        @Size(max = 80, message = "Last name must be 80 characters or fewer")
        @Pattern(regexp = "^$|^[\\p{L}][\\p{L} .'-]*$", message = "Last name contains invalid characters")
        String lastName,
        @NotBlank(message = "Email is required")
        @Email(message = "Enter a valid email address")
        @Size(max = 254, message = "Email must be 254 characters or fewer")
        String email,
        @Size(max = 72, message = "Password must be 72 characters or fewer")
        String password,
        @NotBlank(message = "Phone number is required")
        @Size(min = 10, max = 10, message = "Phone number must be exactly 10 digits")
        @Pattern(regexp = "^0[0-9]{9}$", message = "Phone number must start with 0 and contain exactly 10 digits")
        String phoneNumber,
        @NotBlank(message = "License number is required")
        @Size(min = 8, max = 8, message = "License number must be 8 characters")
        @Pattern(regexp = "^B[0-9]{7}$", message = "License number must start with B followed by 7 digits")
        String licenseNumber,
        @NotNull(message = "License expiry is required")
        @FutureOrPresent(message = "License expiry cannot be in the past")
        LocalDate licenceExpiry,
        @NotNull(message = "Years of experience is required")
        @Min(value = 0, message = "Years of experience cannot be negative")
        @Max(value = 60, message = "Years of experience must be 60 or fewer")
        Integer yearsOfExperience,
        @Size(max = 34, message = "Bank account number must be 34 characters or fewer")
        @Pattern(regexp = "^$|^[A-Za-z0-9][A-Za-z0-9 -]{3,33}$", message = "Bank account number contains invalid characters")
        String accountNumber,
        @Size(max = 100, message = "Bank name must be 100 characters or fewer")
        @Pattern(regexp = "^$|^[\\p{L}][\\p{L} .&'-]*$", message = "Bank name contains invalid characters")
        String bankName,
        @Pattern(regexp = "^(active|inactive|on_leave|suspended)$", message = "Unsupported driver status")
        String status,
        Boolean isVerified,
        Boolean isPhoneVerified,
        @PastOrPresent(message = "Joined date cannot be in the future")
        LocalDate joinedDate,
        @Size(max = 500, message = "Profile photo URL is too long")
        String profilePhoto
) {
}
