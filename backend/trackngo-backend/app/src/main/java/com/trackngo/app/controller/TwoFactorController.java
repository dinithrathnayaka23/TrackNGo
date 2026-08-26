package com.trackngo.app.controller;

import com.trackngo.app.dto.EmailTwoFactorStatusDto;
import com.trackngo.app.dto.TwoFactorCodeRequest;
import com.trackngo.app.dto.TwoFactorSetupDto;
import com.trackngo.app.service.TwoFactorService;
import com.trackngo.commons.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users/{id}/two-factor")
@RequiredArgsConstructor
public class TwoFactorController {
    private final TwoFactorService twoFactorService;

    @PostMapping("/setup")
    public ApiResponse<TwoFactorSetupDto> setup(@PathVariable Long id) {
        return ApiResponse.ok("Two-factor setup started", twoFactorService.beginSetup(id));
    }

    @PostMapping("/enable")
    public ApiResponse<String> enable(@PathVariable Long id, @RequestBody TwoFactorCodeRequest request) {
        return ApiResponse.ok("Two-factor authentication enabled", twoFactorService.enable(id, request));
    }

    @PostMapping("/disable")
    public ApiResponse<Void> disable(@PathVariable Long id, @RequestBody TwoFactorCodeRequest request) {
        twoFactorService.disable(id, request);
        return ApiResponse.ok("Two-factor authentication disabled");
    }

    @GetMapping("/email")
    public ApiResponse<EmailTwoFactorStatusDto> emailStatus(@PathVariable Long id) {
        return ApiResponse.ok("Email two-factor status",
                new EmailTwoFactorStatusDto(twoFactorService.isEmailLoginOtpEnabled(id)));
    }

    @PostMapping("/email/enable")
    public ApiResponse<EmailTwoFactorStatusDto> enableEmail(@PathVariable Long id) {
        boolean enabled = twoFactorService.setEmailLoginOtpEnabled(id, true);
        return ApiResponse.ok("Email two-factor authentication enabled", new EmailTwoFactorStatusDto(enabled));
    }

    @PostMapping("/email/disable")
    public ApiResponse<EmailTwoFactorStatusDto> disableEmail(@PathVariable Long id) {
        boolean enabled = twoFactorService.setEmailLoginOtpEnabled(id, false);
        return ApiResponse.ok("Email two-factor authentication disabled", new EmailTwoFactorStatusDto(enabled));
    }
}
