
package com.trackngo.auth.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ForgotPasswordRequest {
    @NotBlank(message = "Identifier is required")
    private String identifier;

    @NotBlank(message = "Channel is required")
    private String channel; // EMAIL or PHONE

    // Optional. When set (e.g. "driver"), the account must match this user type.
    private String expectedUserType;
}
