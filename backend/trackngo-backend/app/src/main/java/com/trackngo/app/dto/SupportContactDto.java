package com.trackngo.app.dto;

/**
 * Admin-editable "who to contact" details shown to clients while a booking
 * or contract is awaiting review (e.g. the corporate contract negotiation
 * screen). Backed by the single-row {@code support_contact_settings} table.
 */
public record SupportContactDto(
        String name,
        String role,
        String phone,
        String updatedAt
) {
}
