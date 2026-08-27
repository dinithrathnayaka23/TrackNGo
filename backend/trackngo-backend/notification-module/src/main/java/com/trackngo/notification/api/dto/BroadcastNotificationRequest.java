package com.trackngo.notification.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

/** A custom notice an administrator composes and sends to whole groups of users. */
@Data
public class BroadcastNotificationRequest {

    /** Any of "passengers", "drivers", "corporate". At least one is required. */
    @NotEmpty(message = "Choose at least one audience")
    private List<String> audiences;

    /** A key from {@link com.trackngo.notification.api.NotificationType}, e.g. "system_alert". */
    @NotBlank(message = "Notification category is required")
    private String notificationType;

    @NotBlank(message = "Title is required")
    @Size(max = 255, message = "Title must be 255 characters or fewer")
    private String title;

    @NotBlank(message = "Message is required")
    @Size(max = 2000, message = "Message must be 2000 characters or fewer")
    private String message;
}
