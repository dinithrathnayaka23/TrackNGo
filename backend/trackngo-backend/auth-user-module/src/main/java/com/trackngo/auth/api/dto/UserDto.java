package com.trackngo.auth.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserDto {
    private Long id;
    @NotBlank
    private String email;
    @NotBlank
    private String password;
    private String userType;
    private String role;
    private String firstName;
    private String lastName;
    private String phoneNumber;
    /** Token minted by RegistrationOtpService#verifyOtp; required to prove the email was OTP-verified. */
    private String emailVerificationToken;
}