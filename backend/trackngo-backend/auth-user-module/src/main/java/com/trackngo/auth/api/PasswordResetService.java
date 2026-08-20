
package com.trackngo.auth.api;

import com.trackngo.auth.api.dto.ForgotPasswordRequest;
import com.trackngo.auth.api.dto.ForgotPasswordResponse;
import com.trackngo.auth.api.dto.ResendOtpRequest;
import com.trackngo.auth.api.dto.ResetPasswordRequest;
import com.trackngo.auth.api.dto.VerifyOtpRequest;
import com.trackngo.auth.api.dto.VerifyOtpResponse;

public interface PasswordResetService {
    ForgotPasswordResponse forgotPassword(ForgotPasswordRequest request);

    ForgotPasswordResponse resendOtp(ResendOtpRequest request);

    VerifyOtpResponse verifyOtp(VerifyOtpRequest request);

    void resetPassword(ResetPasswordRequest request);
}
