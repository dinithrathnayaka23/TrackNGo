package com.trackngo.notification.internal.controller;

import com.trackngo.notification.api.NotificationService;
import com.trackngo.notification.api.dto.NotificationDto;
import com.trackngo.commons.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {
    private final NotificationService service;

    @PostMapping
    public ApiResponse<NotificationDto> create(@Valid @RequestBody NotificationDto dto) {
        return ApiResponse.ok("Created", service.create(dto));
    }

    @GetMapping("/{id}")
    public ApiResponse<NotificationDto> get(@PathVariable Long id) {
        return ApiResponse.ok("Fetched", service.get(id));
    }

    @GetMapping
    public ApiResponse<List<NotificationDto>> getAll(
        @RequestParam(required = false) Long userId,
        @RequestParam(required = false) String type
    ) {
        if (userId != null) {
            return ApiResponse.ok("Fetched", service.getPassengerNotifications(userId, type));
        }
        return ApiResponse.ok("Fetched", service.getAll());
    }

    @GetMapping("/passenger/{passengerId}")
    public ApiResponse<List<NotificationDto>> getPassengerNotifications(
        @PathVariable Long passengerId,
        @RequestParam(required = false) String type
    ) {
        return ApiResponse.ok("Fetched", service.getPassengerNotifications(passengerId, type));
    }

    @GetMapping("/corporate/{corporateUserId}")
    public ApiResponse<List<NotificationDto>> getCorporateNotifications(
        @PathVariable Long corporateUserId,
        @RequestParam(required = false) String type
    ) {
        return ApiResponse.ok("Fetched", service.getCorporateNotifications(corporateUserId, type));
    }

    @GetMapping("/driver/{driverId}")
    public ApiResponse<List<NotificationDto>> getDriverNotifications(
        @PathVariable Long driverId,
        @RequestParam(required = false) String type
    ) {
        return ApiResponse.ok("Fetched", service.getDriverNotifications(driverId, type));
    }

    @GetMapping("/admin/{adminId}")
    public ApiResponse<List<NotificationDto>> getAdminNotifications(
        @PathVariable Long adminId,
        @RequestParam(required = false) String type
    ) {
        return ApiResponse.ok("Fetched", service.getAdminNotifications(adminId, type));
    }

    @PutMapping("/{id}")
    public ApiResponse<NotificationDto> update(@PathVariable Long id, @Valid @RequestBody NotificationDto dto) {
        return ApiResponse.ok("Updated", service.update(id, dto));
    }

    @PutMapping("/{id}/read")
    public ApiResponse<NotificationDto> markRead(@PathVariable Long id) {
        return ApiResponse.ok("Updated", service.markRead(id));
    }

    @PutMapping("/passenger/{passengerId}/read")
    public ApiResponse<Void> markPassengerNotificationsRead(@PathVariable Long passengerId) {
        service.markPassengerNotificationsRead(passengerId);
        return ApiResponse.ok("Updated", null);
    }

    @PutMapping("/corporate/{corporateUserId}/read")
    public ApiResponse<Void> markCorporateNotificationsRead(@PathVariable Long corporateUserId) {
        service.markCorporateNotificationsRead(corporateUserId);
        return ApiResponse.ok("Updated", null);
    }

    @PutMapping("/driver/{driverId}/read")
    public ApiResponse<Void> markDriverNotificationsRead(@PathVariable Long driverId) {
        service.markDriverNotificationsRead(driverId);
        return ApiResponse.ok("Updated", null);
    }

    @PutMapping("/admin/{adminId}/read")
    public ApiResponse<Void> markAdminNotificationsRead(@PathVariable Long adminId) {
        service.markAdminNotificationsRead(adminId);
        return ApiResponse.ok("Updated", null);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.ok("Deleted", null);
    }

    @DeleteMapping("/passenger/{passengerId}")
    public ApiResponse<Void> deletePassengerNotifications(@PathVariable Long passengerId) {
        service.deletePassengerNotifications(passengerId);
        return ApiResponse.ok("Deleted", null);
    }

    @DeleteMapping("/corporate/{corporateUserId}")
    public ApiResponse<Void> deleteCorporateNotifications(@PathVariable Long corporateUserId) {
        service.deleteCorporateNotifications(corporateUserId);
        return ApiResponse.ok("Deleted", null);
    }

    @DeleteMapping("/driver/{driverId}")
    public ApiResponse<Void> deleteDriverNotifications(@PathVariable Long driverId) {
        service.deleteDriverNotifications(driverId);
        return ApiResponse.ok("Deleted", null);
    }

    @DeleteMapping("/admin/{adminId}")
    public ApiResponse<Void> deleteAdminNotifications(@PathVariable Long adminId) {
        service.deleteAdminNotifications(adminId);
        return ApiResponse.ok("Deleted", null);
    }
}
