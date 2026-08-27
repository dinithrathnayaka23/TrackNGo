
package com.trackngo.auth.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ResendRegistrationOtpRequest {
    @NotBlank(message = "Email is required")
    private String email;
}
