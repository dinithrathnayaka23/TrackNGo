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
}
