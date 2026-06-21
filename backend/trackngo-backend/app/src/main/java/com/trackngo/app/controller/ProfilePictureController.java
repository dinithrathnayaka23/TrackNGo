package com.trackngo.app.controller;

import com.trackngo.app.service.ProfilePictureService;
import com.trackngo.commons.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class ProfilePictureController {

    private final ProfilePictureService profilePictureService;

    @PostMapping("/picture")
    public ApiResponse<ProfilePictureService.UploadResult> uploadProfilePicture(@RequestParam("file") MultipartFile file) {
        return ApiResponse.ok("Profile picture uploaded successfully", profilePictureService.uploadProfilePicture(file));
    }
}
