package com.trackngo.app.controller;

import com.trackngo.app.dto.UserProfileDto;
import com.trackngo.app.service.UserProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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
}