package com.trackngo.app.dto;

import java.time.LocalDate;

/**
 * Mutual-consent cancellation state for a corporate contract. {@code status}
 * is one of "none", "pending", "accepted", "rejected". {@code requestedBy}
 * is "admin" or "corporate" — whoever asked to cancel — and is null when
 * status is "none". {@code effectiveDate} is only set for an admin-initiated
 * request on an already-active contract (minimum 2 weeks out); it stays
 * active in the meantime and a scheduled job cancels it once that date arrives.
 */
public record ContractCancellationDto(
        String status,
        String requestedBy,
        String reason,
        String requestedAt,
        LocalDate effectiveDate,
        String responseReason
) {
}
