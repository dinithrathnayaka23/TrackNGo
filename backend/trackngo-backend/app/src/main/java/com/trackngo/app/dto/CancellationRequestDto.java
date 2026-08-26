package com.trackngo.app.dto;

/** Body for POST /api/corporate/contracts/{id}/cancel-request. */
public record CancellationRequestDto(String role, String reason) {
}
