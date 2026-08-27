package com.trackngo.app.controller;

import com.trackngo.app.dto.UpdateUserProfileRequest;
import com.trackngo.app.dto.UserProfileDto;
import com.trackngo.app.service.ProfilePictureService;
import com.trackngo.app.service.UserProfileService;
import com.trackngo.commons.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class ProfilePictureController {

    private final ProfilePictureService profilePictureService;
    private final UserProfileService userProfileService;

    @GetMapping
    public UserProfileDto getCurrentProfile() {
        return userProfileService.getCurrentProfile();
    }

    @PutMapping
    public UserProfileDto updateCurrentProfile(@RequestBody UpdateUserProfileRequest request) {
        return userProfileService.updateCurrentProfile(request);
    }

    @PostMapping("/picture")
    public ApiResponse<ProfilePictureService.UploadResult> uploadProfilePicture(@RequestParam("file") MultipartFile file) {
        return ApiResponse.ok("Profile picture uploaded successfully", profilePictureService.uploadProfilePicture(file));
    }

    @DeleteMapping("/picture")
    public ApiResponse<ProfilePictureService.DeleteResult> deleteProfilePicture() {
        ProfilePictureService.DeleteResult result = profilePictureService.deleteOwnProfilePicture();
        return ApiResponse.ok(
                result.removed() ? "Profile picture removed successfully" : "There is no profile picture to remove",
                result
        );
    }
}
