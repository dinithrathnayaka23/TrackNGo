package com.trackngo.app.config;

import java.util.Arrays;

/**
 * Parses the comma-separated {@code trackngo.cors.allowed-origins} property
 * (backed by the FRONTEND_URL env var) into the origin-pattern array Spring's
 * CORS/WebSocket registries expect. Shared by every place that previously
 * hardcoded {@code allowedOriginPatterns("*")}, so all of them stay in step.
 */
final class CorsOrigins {

    private CorsOrigins() {
    }

    static String[] parse(String allowedOrigins) {
        if (allowedOrigins == null || allowedOrigins.isBlank()) {
            return new String[0];
        }
        return Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .toArray(String[]::new);
    }
}
