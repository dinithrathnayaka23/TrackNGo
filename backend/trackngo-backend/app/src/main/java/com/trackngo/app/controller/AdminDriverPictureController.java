package com.trackngo.app.controller;

import com.trackngo.app.service.ProfilePictureService;
import com.trackngo.commons.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Drivers cannot change their own picture - it is part of the account an administrator
 * maintains for them - so removing one is offered here rather than in the driver app.
 */
@RestController
@RequestMapping("/api/admin/drivers")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminDriverPictureController {

    private final ProfilePictureService profilePictureService;

    @DeleteMapping("/{driverId}/profile-picture")
    public ApiResponse<ProfilePictureService.DeleteResult> deleteDriverProfilePicture(@PathVariable Long driverId) {
        ProfilePictureService.DeleteResult result = profilePictureService.deleteDriverProfilePicture(driverId);
        return ApiResponse.ok(
                result.removed() ? "Driver profile picture removed" : "This driver has no profile picture to remove",
                result
        );
    }
}
