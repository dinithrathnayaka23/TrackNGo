package com.trackngo.auth.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ResendTwoFactorOtpRequest {
    @NotBlank
    private String challengeToken;
}
