package com.trackngo.app.controller;

import com.trackngo.app.dto.CorporateProfileDto;
import com.trackngo.app.service.CorporateProfileService;
import com.trackngo.commons.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class CorporateProfileController {

    private final CorporateProfileService corporateProfileService;

    @PostMapping("/{id}/corporate")
    public ApiResponse<Void> saveProfile(
            @PathVariable("id") Long userId,
            @RequestBody CorporateProfileDto dto
    ) {
        corporateProfileService.saveProfile(userId, dto);
        return ApiResponse.ok("Corporate profile saved successfully", null);
    }
}
