package com.trackngo.notification.internal.controller;

import com.trackngo.commons.ApiResponse;
import com.trackngo.notification.api.NotificationBroadcastService;
import com.trackngo.notification.api.dto.AudienceCountsDto;
import com.trackngo.notification.api.dto.BroadcastNotificationRequest;
import com.trackngo.notification.api.dto.BroadcastResultDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Lets an administrator write a notice of their own and send it to whole audiences.
 *
 * Separate from {@link NotificationController}, whose endpoints are open so the apps can
 * read their own feeds: a broadcast reaches every user at once, so it stays behind an
 * admin session.
 */
@RestController
@RequestMapping("/api/admin/notifications")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminBroadcastController {

    private final NotificationBroadcastService service;

    /** Reports how many accounts each audience holds, so a send can be sized beforehand. */
    @GetMapping("/audience-counts")
    public ApiResponse<AudienceCountsDto> audienceCounts() {
        return ApiResponse.ok("Fetched", service.getAudienceCounts());
    }

    @PostMapping("/broadcast")
    public ApiResponse<BroadcastResultDto> broadcast(@Valid @RequestBody BroadcastNotificationRequest request) {
        BroadcastResultDto result = service.broadcast(request);
        return ApiResponse.ok("Notification sent to " + result.total() + " recipients", result);
    }
}
