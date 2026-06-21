
package com.trackngo.auth.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class AuthResponse {
    private String token;
    private Long userId;
    private String userType;
    private String email;
    private String firstName;
    private String lastName;
}

