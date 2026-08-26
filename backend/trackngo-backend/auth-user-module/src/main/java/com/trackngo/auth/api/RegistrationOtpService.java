
package com.trackngo.auth.api;

import com.trackngo.auth.api.dto.RegistrationOtpResponse;
import com.trackngo.auth.api.dto.ResendRegistrationOtpRequest;
import com.trackngo.auth.api.dto.SendRegistrationOtpRequest;
import com.trackngo.auth.api.dto.VerifyRegistrationOtpRequest;
import com.trackngo.auth.api.dto.VerifyRegistrationOtpResponse;

public interface RegistrationOtpService {
    RegistrationOtpResponse sendOtp(SendRegistrationOtpRequest request);

    RegistrationOtpResponse resendOtp(ResendRegistrationOtpRequest request);

    VerifyRegistrationOtpResponse verifyOtp(VerifyRegistrationOtpRequest request);

    /**
     * Consumes a verification token minted by {@link #verifyOtp}, confirming it
     * belongs to the given email, is verified, unexpired, and not already used.
     * Called by account creation right before the user row is inserted.
     */
    void consumeVerificationToken(String email, String verificationToken);
}
