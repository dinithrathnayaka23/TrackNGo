package com.trackngo.app.controller;

import com.trackngo.app.dto.UpdateUserSettingsRequest;
import com.trackngo.app.dto.UserSettingsDto;
import com.trackngo.app.service.UserSettingsService;
import com.trackngo.commons.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserSettingsController {

    private final UserSettingsService userSettingsService;

    @GetMapping("/{id}/settings")
    public ApiResponse<UserSettingsDto> getSettings(@PathVariable("id") Long userId) {
        return ApiResponse.ok("Settings fetched", userSettingsService.getSettings(userId));
    }

    @PutMapping("/{id}/settings")
    public ApiResponse<UserSettingsDto> updateSettings(
            @PathVariable("id") Long userId,
            @RequestBody UpdateUserSettingsRequest request
    ) {
        return ApiResponse.ok("Settings updated", userSettingsService.updateSettings(userId, request));
    }
}
