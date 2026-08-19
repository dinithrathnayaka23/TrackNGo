
package com.trackngo.auth.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class ForgotPasswordResponse {
    private String maskedDestination;
    private String channel;
    private long expiresInSeconds;
    private long resendCooldownSeconds;
}
