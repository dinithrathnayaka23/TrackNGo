
package com.trackngo.auth.internal.controller;

import com.trackngo.auth.api.AuthService;
import com.trackngo.auth.api.dto.AdminRegisterRequest;
import com.trackngo.auth.api.dto.AuthRequest;
import com.trackngo.auth.api.dto.AuthResponse;
import com.trackngo.auth.api.dto.ResendTwoFactorOtpRequest;
import com.trackngo.auth.api.dto.TwoFactorVerifyRequest;
import com.trackngo.commons.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;

    @PostMapping("/login")
    public ApiResponse<AuthResponse> login(@Valid @RequestBody AuthRequest request) { //@Valid @RequestBody means that the request body must be valid
        return ApiResponse.ok("Login successful", authService.login(request));
    }

    @PostMapping("/register")
    public ApiResponse<AuthResponse> register(@Valid @RequestBody AuthRequest request) {
        return ApiResponse.ok("Registration successful", authService.register(request));
    }

    @PostMapping("/register-admin")
    public ApiResponse<Void> registerAdmin(@Valid @RequestBody AdminRegisterRequest request) {
        authService.registerAdmin(request);
        return ApiResponse.ok("Admin registration successful. You can now log in.");
    }

    @PostMapping("/2fa/verify")
    public ApiResponse<AuthResponse> verifyTwoFactor(@Valid @RequestBody TwoFactorVerifyRequest request) {
        return ApiResponse.ok("Two-factor verification successful", authService.verifyTwoFactor(request));
    }

    @PostMapping("/2fa/resend")
    public ApiResponse<Void> resendTwoFactorOtp(@Valid @RequestBody ResendTwoFactorOtpRequest request) {
        authService.resendTwoFactorOtp(request);
        return ApiResponse.ok("A new verification code was sent to your email");
    }
}


