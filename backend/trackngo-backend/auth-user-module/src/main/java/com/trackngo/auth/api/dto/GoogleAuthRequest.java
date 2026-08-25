package com.trackngo.auth.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class GoogleAuthRequest {
    @NotBlank
    private String idToken;
}
