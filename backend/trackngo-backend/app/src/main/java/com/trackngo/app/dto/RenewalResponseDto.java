package com.trackngo.app.dto;

/** Body for POST /api/corporate/contracts/{id}/renewal-response. Admin only. */
public record RenewalResponseDto(boolean approve) {
}
