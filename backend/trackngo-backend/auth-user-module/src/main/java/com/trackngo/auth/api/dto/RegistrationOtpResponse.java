
package com.trackngo.auth.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class RegistrationOtpResponse {
    private String maskedEmail;
    private long expiresInSeconds;
    private long resendCooldownSeconds;
}
