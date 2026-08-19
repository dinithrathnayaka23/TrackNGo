
package com.trackngo.auth.api;

import com.trackngo.auth.api.dto.AdminRegisterRequest;
import com.trackngo.auth.api.dto.AuthRequest;
import com.trackngo.auth.api.dto.AuthResponse;
import com.trackngo.auth.api.dto.TwoFactorVerifyRequest;

public interface AuthService {
    AuthResponse login(AuthRequest request);
    AuthResponse register(AuthRequest request);
    void registerAdmin(AdminRegisterRequest request);
    AuthResponse verifyTwoFactor(TwoFactorVerifyRequest request);
}

