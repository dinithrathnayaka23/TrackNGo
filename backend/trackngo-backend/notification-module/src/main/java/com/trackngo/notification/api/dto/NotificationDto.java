package com.trackngo.notification.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import java.time.LocalDateTime;

@Data
public class NotificationDto {
    private Long id;

    @NotBlank
    private String notificationType;

    @NotBlank
    private String title;

    @NotBlank
    private String message;

    private Boolean read;
    private LocalDateTime createdAt;
    private Long passengerId;
    private Long corporateUserId;
    private Long driverId;
    private Long adminId;
}
