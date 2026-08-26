
package com.trackngo.auth.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class VerifyRegistrationOtpResponse {
    private String verificationToken;
    private long expiresInSeconds;
}
