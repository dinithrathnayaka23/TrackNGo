package com.trackngo.app.dto;

public record TwoFactorSetupDto(String secret, String provisioningUri) {
}
