package com.trackngo.app.service;

import com.trackngo.app.dto.SupportContactDto;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * The single admin-configurable support contact (name, role, phone) shown to
 * clients while a booking or contract is awaiting review, so it no longer
 * needs to be hardcoded on the client. Mirrors the single-row settings
 * pattern already used by {@link CorporatePricingService}.
 */
@Service
@RequiredArgsConstructor
public class SupportContactService {

    private final JdbcTemplate jdbcTemplate;

    private static final String SETTINGS_SQL = """
            SELECT name, role, phone, updated_at
            FROM support_contact_settings
            WHERE id = 1
            """;

    private static final SupportContactDto DEFAULT_CONTACT =
            new SupportContactDto("TrackNGo Support", "Support Team", "+94701803826", null);

    public SupportContactDto getSettings() {
        return jdbcTemplate.query(SETTINGS_SQL, rs -> {
            if (!rs.next()) {
                return DEFAULT_CONTACT;
            }
            return new SupportContactDto(
                    rs.getString("name"),
                    rs.getString("role"),
                    rs.getString("phone"),
                    rs.getString("updated_at")
            );
        });
    }

    public SupportContactDto updateSettings(SupportContactDto request) {
        validate(request);
        jdbcTemplate.update("""
                UPDATE support_contact_settings SET name = ?, role = ?, phone = ?
                WHERE id = 1
                """,
                request.name().trim(), request.role().trim(), request.phone().trim());
        return getSettings();
    }

    private static void validate(SupportContactDto request) {
        if (request.name() == null || request.name().isBlank()) {
            throw new IllegalArgumentException("Contact name is required.");
        }
        if (request.role() == null || request.role().isBlank()) {
            throw new IllegalArgumentException("Contact role is required.");
        }
        if (request.phone() == null || request.phone().isBlank()) {
            throw new IllegalArgumentException("Contact phone number is required.");
        }
    }
}
