package com.trackngo.app.service;

import com.trackngo.app.dto.UserProfileDto;
import com.trackngo.commons.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserProfileService {

    private static final String PROFILE_SQL = """
            SELECT
                u.user_id AS user_id,
                TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS full_name,
                COALESCE(p.mobile_number, d.phone_number, cu.contact_phone, a.phone_number) AS phone_number,
                u.email AS email,
                COALESCE(p.profile_photo, d.profile_photo, cu.profile_photo) AS profile_photo,
                cu.company_name AS company_name,
                cu.contact_person_name AS contact_person_name,
                u.user_type AS user_type
            FROM `user` u
            LEFT JOIN passenger p ON p.passenger_id = u.user_id
            LEFT JOIN driver d ON d.driver_id = u.user_id
            LEFT JOIN corporate_user cu ON cu.corporate_user_id = u.user_id
            LEFT JOIN admin a ON a.admin_id = u.user_id
            WHERE u.user_id = ?
            """;

    private final JdbcTemplate jdbcTemplate;

    public UserProfileDto getProfile(Long userId) {
        return jdbcTemplate.query(PROFILE_SQL, rs -> {
            if (!rs.next()) {
                throw new ResourceNotFoundException("User profile not found");
            }

            return new UserProfileDto(
                    rs.getLong("user_id"),
                    clean(rs.getString("full_name")),
                    clean(rs.getString("phone_number")),
                    clean(rs.getString("email")),
                    clean(rs.getString("profile_photo")),
                    clean(rs.getString("company_name")),
                    clean(rs.getString("contact_person_name")),
                    mapUserType(rs.getString("user_type"))
            );
        }, userId);
    }

    private String clean(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String mapUserType(String userType) {
        if (userType == null) {
            return null;
        }

        return switch (userType.trim().toLowerCase()) {
            case "corporate" -> "CORPORATE_USER";
            case "passenger" -> "PASSENGER";
            case "driver" -> "DRIVER";
            case "admin" -> "ADMIN";
            default -> userType.trim().toUpperCase();
        };
    }
}