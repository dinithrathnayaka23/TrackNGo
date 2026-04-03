package com.trackngo.notification.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class NotificationDto {
    private Long id;
    @NotBlank
    private String name;
}
