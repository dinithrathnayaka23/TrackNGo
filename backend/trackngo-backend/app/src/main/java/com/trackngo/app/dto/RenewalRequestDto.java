package com.trackngo.app.dto;

/** Body for POST /api/corporate/contracts/{id}/renew. */
public record RenewalRequestDto(String role, Long userId) {
}
