package com.trackngo.app.dto;

/** Body for POST /api/corporate/contracts/{id}/cancel-response. */
public record CancellationResponseDto(String role, boolean accept, String responseReason) {
}
