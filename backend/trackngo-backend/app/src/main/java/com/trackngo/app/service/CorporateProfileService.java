package com.trackngo.app.service;

import com.trackngo.app.dto.CorporateProfileDto;
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
                contact_person_name,
                contact_phone,
                contact_person_designation,
                status,
                business_registration_number,
                industry,
                profile_photo
            ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                address = VALUES(address),
                company_name = VALUES(company_name),
                contact_person_name = VALUES(contact_person_name),
                contact_phone = VALUES(contact_phone),
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
        // Ensure user_type is set to 'corporate'
        jdbcTemplate.update(UPDATE_USER_TYPE_SQL, userId);

        // Save corporate user profile details
        jdbcTemplate.update(
                INSERT_OR_UPDATE_SQL,
                userId,
                dto.address(),
                dto.companyName(),
                dto.contactPersonName(),
                dto.contactPhone(),
                dto.contactPersonDesignation(),
                dto.businessRegistrationNumber(),
                dto.industry(),
                dto.profilePhoto()
        );
    }
}
