package com.trackngo.app.dto;

/**
 * Body for POST /api/corporate/contracts/{id}/cancel-response.
 * {@code cancelTiming} ("immediate" or "scheduled") is required only when
 * accepting an admin-initiated cancellation of an already-active contract —
 * it is ignored otherwise, since every other accepted cancellation takes
 * effect immediately.
 */
public record CancellationResponseDto(String role, boolean accept, String responseReason, String cancelTiming) {
}
