package com.trackngo.app.controller;

import com.trackngo.app.dto.UserProfileDto;
import com.trackngo.app.dto.ChangePasswordRequest;
import com.trackngo.app.dto.UpdateUserProfileRequest;
import com.trackngo.app.service.UserProfileService;
import com.trackngo.commons.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserProfileController {

    private final UserProfileService userProfileService;

    @GetMapping("/{id}/profile")
    public UserProfileDto getProfile(@PathVariable("id") Long userId) {
        return userProfileService.getProfile(userId);
    }

    @PutMapping("/{id}/profile")
    public UserProfileDto updateProfile(
            @PathVariable("id") Long userId,
            @RequestBody UpdateUserProfileRequest request
    ) {
        return userProfileService.updateProfile(userId, request);
    }

    @PostMapping("/{id}/password")
    public ApiResponse<Void> changePassword(
            @PathVariable("id") Long userId,
            @RequestBody ChangePasswordRequest request
    ) {
        userProfileService.changePassword(userId, request);
        return ApiResponse.ok("Password changed", null);
    }
}
