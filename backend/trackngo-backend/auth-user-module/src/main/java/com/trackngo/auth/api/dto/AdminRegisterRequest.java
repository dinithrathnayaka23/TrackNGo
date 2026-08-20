package com.trackngo.auth.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AdminRegisterRequest {
    @NotBlank
    private String fullName;

    @NotBlank
    private String employeeId;

    @NotBlank
    private String email;

    @NotBlank
    private String phone;

    @NotBlank
    private String password;
}
