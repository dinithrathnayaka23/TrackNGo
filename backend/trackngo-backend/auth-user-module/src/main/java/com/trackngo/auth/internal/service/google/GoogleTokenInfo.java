package com.trackngo.auth.internal.service.google;

public record GoogleTokenInfo(
        String email,
        boolean emailVerified,
        String firstName,
        String lastName,
        String subject
) {
}
