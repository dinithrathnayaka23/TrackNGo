
package com.trackngo.auth.internal.controller;

import com.trackngo.auth.api.RegistrationOtpService;
import com.trackngo.auth.api.dto.RegistrationOtpResponse;
import com.trackngo.auth.api.dto.ResendRegistrationOtpRequest;
import com.trackngo.auth.api.dto.SendRegistrationOtpRequest;
import com.trackngo.auth.api.dto.VerifyRegistrationOtpRequest;
import com.trackngo.auth.api.dto.VerifyRegistrationOtpResponse;
import com.trackngo.commons.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth/registration")
@RequiredArgsConstructor
public class RegistrationOtpController {
    private final RegistrationOtpService registrationOtpService;

    @PostMapping("/send-otp")
    public ApiResponse<RegistrationOtpResponse> sendOtp(@Valid @RequestBody SendRegistrationOtpRequest request) {
        RegistrationOtpResponse response = registrationOtpService.sendOtp(request);
        return ApiResponse.ok("Verification code sent to " + response.getMaskedEmail(), response);
    }

    @PostMapping("/resend-otp")
    public ApiResponse<RegistrationOtpResponse> resendOtp(@Valid @RequestBody ResendRegistrationOtpRequest request) {
        RegistrationOtpResponse response = registrationOtpService.resendOtp(request);
        return ApiResponse.ok("A new verification code was sent to " + response.getMaskedEmail(), response);
    }

    @PostMapping("/verify-otp")
    public ApiResponse<VerifyRegistrationOtpResponse> verifyOtp(@Valid @RequestBody VerifyRegistrationOtpRequest request) {
        VerifyRegistrationOtpResponse response = registrationOtpService.verifyOtp(request);
        return ApiResponse.ok("Email verified", response);
    }
}
