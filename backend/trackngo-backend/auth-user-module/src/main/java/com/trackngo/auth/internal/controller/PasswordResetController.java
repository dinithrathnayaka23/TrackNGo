
package com.trackngo.auth.internal.controller;

import com.trackngo.auth.api.PasswordResetService;
import com.trackngo.auth.api.dto.ForgotPasswordRequest;
import com.trackngo.auth.api.dto.ForgotPasswordResponse;
import com.trackngo.auth.api.dto.ResendOtpRequest;
import com.trackngo.auth.api.dto.ResetPasswordRequest;
import com.trackngo.auth.api.dto.VerifyOtpRequest;
import com.trackngo.auth.api.dto.VerifyOtpResponse;
import com.trackngo.commons.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class PasswordResetController {
    private final PasswordResetService passwordResetService;

    @PostMapping("/forgot-password")
    public ApiResponse<ForgotPasswordResponse> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        ForgotPasswordResponse response = passwordResetService.forgotPassword(request);
        return ApiResponse.ok("Verification code sent to " + response.getMaskedDestination(), response);
    }

    @PostMapping("/resend-otp")
    public ApiResponse<ForgotPasswordResponse> resendOtp(@Valid @RequestBody ResendOtpRequest request) {
        ForgotPasswordResponse response = passwordResetService.resendOtp(request);
        return ApiResponse.ok("A new verification code was sent to " + response.getMaskedDestination(), response);
    }

    @PostMapping("/verify-otp")
    public ApiResponse<VerifyOtpResponse> verifyOtp(@Valid @RequestBody VerifyOtpRequest request) {
        VerifyOtpResponse response = passwordResetService.verifyOtp(request);
        return ApiResponse.ok("Code verified", response);
    }

    @PostMapping("/reset-password")
    public ApiResponse<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        passwordResetService.resetPassword(request);
        return ApiResponse.ok("Password reset successful");
    }
}
