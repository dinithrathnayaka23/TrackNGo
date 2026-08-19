
package com.trackngo.auth.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AuthRequest {
    @NotBlank
    private String identifier;
    @NotBlank
    private String password;
    private String expectedUserType;
    private String trustedDeviceToken;
}

