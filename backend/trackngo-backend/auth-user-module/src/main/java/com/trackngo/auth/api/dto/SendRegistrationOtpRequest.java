
package com.trackngo.auth.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SendRegistrationOtpRequest {
    @NotBlank(message = "Email is required")
    private String email;
}
