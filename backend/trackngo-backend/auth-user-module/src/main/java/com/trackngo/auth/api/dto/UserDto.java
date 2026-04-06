
package com.trackngo.auth.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UserDto {
    private Long id;
    @NotBlank
    private String username;
    private String password;
    private String role;
}

