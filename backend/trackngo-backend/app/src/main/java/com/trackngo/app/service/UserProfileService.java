package com.trackngo.app.service;

import com.trackngo.app.dto.UserProfileDto;
import com.trackngo.app.dto.ChangePasswordRequest;
import com.trackngo.app.dto.UpdateUserProfileRequest;
import com.trackngo.auth.internal.repository.UserRepository;
import com.trackngo.commons.exception.BusinessException;
import com.trackngo.commons.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class UserProfileService {

    private static final String PROFILE_SQL = """
            SELECT
                u.user_id AS user_id,
                TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS full_name,
                COALESCE(p.mobile_number, d.phone_number, cu.contact_phone, a.phone_number) AS phone_number,
                u.email AS email,
                COALESCE(p.profile_photo, d.profile_photo, cu.profile_photo, a.profile_photo) AS profile_photo,
                cu.company_name AS company_name,
                cu.contact_person_name AS contact_person_name,
                cu.contact_phone AS contact_phone,
                cu.contact_person_designation AS contact_person_designation,
                cu.address AS address,
                cu.business_registration_number AS business_registration_number,
                cu.industry AS industry,
                u.user_type AS user_type
            FROM `user` u
            LEFT JOIN passenger p ON p.passenger_id = u.user_id
            LEFT JOIN driver d ON d.driver_id = u.user_id
            LEFT JOIN corporate_user cu ON cu.corporate_user_id = u.user_id
            LEFT JOIN admin a ON a.admin_id = u.user_id
            WHERE u.user_id = ?
            """;

    private final JdbcTemplate jdbcTemplate;
    private final PasswordEncoder passwordEncoder;
    private final UserRepository userRepository;

    public UserProfileDto getCurrentProfile() {
        return getProfile(getAuthenticatedUserId());
    }

    @Transactional
    public UserProfileDto updateCurrentProfile(UpdateUserProfileRequest request) {
        return updateProfile(getAuthenticatedUserId(), request);
    }

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
                    clean(rs.getString("contact_phone")),
                    clean(rs.getString("contact_person_designation")),
                    clean(rs.getString("address")),
                    clean(rs.getString("business_registration_number")),
                    clean(rs.getString("industry")),
                    mapUserType(rs.getString("user_type")));
        }, userId);
    }

    @Transactional
    public UserProfileDto updateProfile(Long userId, UpdateUserProfileRequest request) {
        Map<String, Object> current = jdbcTemplate.queryForMap(
                "SELECT email, user_type FROM `user` WHERE user_id = ?",
                userId);
        ensureCanModifyProfile(userId, String.valueOf(current.get("user_type")));

        String email = clean(request.email());
        if (email == null) {
            email = String.valueOf(current.get("email"));
        }

        Integer duplicate = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM `user` WHERE LOWER(email) = LOWER(?) AND user_id <> ?",
                Integer.class,
                email,
                userId);
        if (duplicate != null && duplicate > 0) {
            throw new BusinessException("That email address is already in use.");
        }

        String[] name = splitName(request.fullName());
        jdbcTemplate.update(
                "UPDATE `user` SET first_name = ?, last_name = ?, email = ? WHERE user_id = ?",
                name[0],
                name[1],
                email,
                userId);

        String userType = String.valueOf(current.get("user_type")).toLowerCase(Locale.ROOT);
        String phone = clean(request.phoneNumber());
        if (phone != null) {
            switch (userType) {
                case "passenger" -> jdbcTemplate.update(
                        "UPDATE passenger SET mobile_number = ? WHERE passenger_id = ?",
                        phone,
                        userId);
                case "driver" -> jdbcTemplate.update(
                        "UPDATE driver SET phone_number = ? WHERE driver_id = ?",
                        phone,
                        userId);
                case "corporate" -> jdbcTemplate.update(
                        "UPDATE corporate_user SET contact_phone = ? WHERE corporate_user_id = ?",
                        phone,
                        userId);
                case "admin" -> jdbcTemplate.update(
                        "UPDATE admin SET phone_number = ? WHERE admin_id = ?",
                        phone,
                        userId);
                default -> {
                }
            }
        }

        if (clean(request.profilePhoto()) != null) {
            switch (userType) {
                case "passenger" -> jdbcTemplate.update(
                        "UPDATE passenger SET profile_photo = ? WHERE passenger_id = ?",
                        clean(request.profilePhoto()), userId);
                case "driver" -> jdbcTemplate.update(
                        "UPDATE driver SET profile_photo = ? WHERE driver_id = ?",
                        clean(request.profilePhoto()), userId);
                case "corporate" -> jdbcTemplate.update(
                        "UPDATE corporate_user SET profile_photo = ? WHERE corporate_user_id = ?",
                        clean(request.profilePhoto()), userId);
                case "admin" -> jdbcTemplate.update(
                        "UPDATE admin SET profile_photo = ? WHERE admin_id = ?",
                        clean(request.profilePhoto()), userId);
                default -> {
                }
            }
        }

        return getProfile(userId);
    }

    @Transactional
    public void changePassword(Long userId, ChangePasswordRequest request) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || authentication.getName() == null
                || "anonymousUser".equals(authentication.getName())) {
            throw new BusinessException("You must be logged in to change your password.");
        }

        Map<String, Object> user = jdbcTemplate.queryForMap(
                "SELECT email, password FROM `user` WHERE user_id = ?",
                userId);
        if (!authentication.getName().equalsIgnoreCase(String.valueOf(user.get("email")))) {
            throw new BusinessException("You can only change your own password.");
        }

        String currentPassword = request.currentPassword() == null ? "" : request.currentPassword();
        String newPassword = request.newPassword() == null ? "" : request.newPassword();
        String confirmPassword = request.confirmPassword() == null ? "" : request.confirmPassword();
        if (!passwordEncoder.matches(currentPassword, String.valueOf(user.get("password")))) {
            throw new BusinessException("The current password is incorrect.");
        }
        if (newPassword.length() < 6) {
            throw new BusinessException("The new password must contain at least 6 characters.");
        }
        if (!newPassword.equals(confirmPassword)) {
            throw new BusinessException("The new passwords do not match.");
        }

        jdbcTemplate.update(
                "UPDATE `user` SET password = ? WHERE user_id = ?",
                passwordEncoder.encode(newPassword),
                userId);
    }

    private String[] splitName(String value) {
        String fullName = clean(value);
        if (fullName == null) {
            return new String[] { "", "" };
        }
        int separator = fullName.indexOf(' ');
        if (separator < 0) {
            return new String[] { fullName, "" };
        }
        return new String[] {
                fullName.substring(0, separator).trim(),
                fullName.substring(separator + 1).trim()
        };
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

    private Long getAuthenticatedUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || authentication.getName() == null
                || "anonymousUser".equals(authentication.getName())) {
            throw new BusinessException("You must be logged in to view your profile.");
        }

        return userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResourceNotFoundException("Authenticated user not found."))
                .getId();
    }

    private void ensureCanModifyProfile(Long userId, String userType) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || authentication.getName() == null
                || "anonymousUser".equals(authentication.getName())) {
            throw new BusinessException("You must be logged in to update a profile.");
        }

        boolean admin = authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
        if (admin) {
            return;
        }

        Long authenticatedId = getAuthenticatedUserId();
        if (!authenticatedId.equals(userId)) {
            throw new BusinessException("You can only update your own profile.");
        }
        if ("driver".equalsIgnoreCase(userType)) {
            throw new BusinessException(
                    "Driver profile details are managed by an administrator. Only password changes are allowed.");
        }
    }
}
