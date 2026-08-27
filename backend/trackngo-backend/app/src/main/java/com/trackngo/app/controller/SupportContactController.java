package com.trackngo.app.controller;

import com.trackngo.app.dto.SupportContactDto;
import com.trackngo.app.service.SupportContactService;
import com.trackngo.commons.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The admin-configurable support contact shown to clients while a booking or
 * contract is awaiting review (e.g. the corporate contract negotiation
 * screen), replacing what used to be a hardcoded name/phone on the client.
 */
@RestController
@RequestMapping("/api/admin/support-contact")
@RequiredArgsConstructor
public class SupportContactController {

    private final SupportContactService supportContactService;

    @GetMapping
    public ApiResponse<SupportContactDto> getSupportContact() {
        return ApiResponse.ok("Support contact fetched successfully", supportContactService.getSettings());
    }

    @PutMapping
    public ApiResponse<SupportContactDto> updateSupportContact(
            @RequestBody SupportContactDto request, Authentication authentication) {
        requireAdmin(authentication);
        try {
            return ApiResponse.ok("Support contact updated successfully", supportContactService.updateSettings(request));
        } catch (IllegalArgumentException ex) {
            return ApiResponse.fail(ex.getMessage());
        }
    }

    private void requireAdmin(Authentication authentication) {
        boolean isAdmin = authentication != null && authentication.getAuthorities().stream()
                .map(authority -> authority.getAuthority() == null ? "" : authority.getAuthority().trim())
                .anyMatch(authority -> "ROLE_ADMIN".equalsIgnoreCase(authority) || "ADMIN".equalsIgnoreCase(authority));
        if (!isAdmin) {
            throw new SecurityException("Administrator access is required.");
        }
    }
}
