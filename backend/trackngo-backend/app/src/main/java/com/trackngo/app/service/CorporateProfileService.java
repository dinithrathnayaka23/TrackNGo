package com.trackngo.app.service;

import com.trackngo.app.dto.CorporateProfileDto;
import com.trackngo.app.util.Industries;
import com.trackngo.app.util.ProfileValidation;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CorporateProfileService {

    private final JdbcTemplate jdbcTemplate;

    private static final String INSERT_OR_UPDATE_SQL = """
            INSERT INTO corporate_user (
                corporate_user_id,
                address,
                company_name,
                website,
                employee_count,
                contact_person_name,
                contact_phone,
                contact_email,
                contact_person_designation,
                status,
                business_registration_number,
                industry,
                profile_photo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                address = VALUES(address),
                company_name = VALUES(company_name),
                website = VALUES(website),
                employee_count = VALUES(employee_count),
                contact_person_name = VALUES(contact_person_name),
                contact_phone = VALUES(contact_phone),
                contact_email = VALUES(contact_email),
                contact_person_designation = VALUES(contact_person_designation),
                business_registration_number = VALUES(business_registration_number),
                industry = VALUES(industry),
                profile_photo = VALUES(profile_photo);
            """;

    private static final String UPDATE_USER_TYPE_SQL = """
            UPDATE `user` SET user_type = 'corporate' WHERE user_id = ?;
            """;

    @Transactional
    public void saveProfile(Long userId, CorporateProfileDto dto) {
        validate(dto);

        // Ensure user_type is set to 'corporate'
        jdbcTemplate.update(UPDATE_USER_TYPE_SQL, userId);

        // Save corporate user profile details
        jdbcTemplate.update(
                INSERT_OR_UPDATE_SQL,
                userId,
                dto.address(),
                dto.companyName(),
                dto.website(),
                dto.employeeCount(),
                dto.contactPersonName(),
                dto.contactPhone(),
                dto.contactEmail(),
                dto.contactPersonDesignation(),
                dto.businessRegistrationNumber(),
                dto.industry(),
                dto.profilePhoto()
        );
    }

    /**
     * Rejects placeholder text (e.g. "test") on the fields that matter for a
     * genuine corporate profile, so garbage data can never be saved from the
     * API even if the client-side form validation is bypassed.
     */
    private void validate(CorporateProfileDto dto) {
        ProfileValidation.requireRealText(dto.companyName(), "Company name", 2);
        ProfileValidation.requireRealText(dto.businessRegistrationNumber(), "Business registration number", 3);
        if (!Industries.isValid(dto.industry())) {
            throw new IllegalArgumentException("Industry must be one of the listed options.");
        }
        ProfileValidation.requireRealText(dto.address(), "Address", 5);
        ProfileValidation.requireRealText(dto.contactPersonName(), "Contact person name", 2);
        ProfileValidation.requireRealText(dto.contactPersonDesignation(), "Contact person designation", 2);
        ProfileValidation.requireValidSriLankanPhone(dto.contactPhone(), "Contact phone");
        ProfileValidation.requireValidEmail(dto.contactEmail(), "Contact email");
        if (dto.employeeCount() != null && dto.employeeCount() < 0) {
            throw new IllegalArgumentException("Employee count cannot be negative.");
        }
    }
}
