
package com.trackngo.auth.internal.service;

import com.trackngo.auth.api.UserService;
import com.trackngo.auth.api.dto.UserDto;
import com.trackngo.auth.api.dto.AdminUserDto;
import com.trackngo.auth.internal.entity.User;
import com.trackngo.auth.internal.repository.UserRepository;
import com.trackngo.commons.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbcTemplate;

    @Override
    public UserDto create(UserDto dto) {
        User user = new User();
        user.setEmail(dto.getEmail());
        if (dto.getPassword() != null) {
            user.setPassword(passwordEncoder.encode(dto.getPassword()));
        }
        user.setUserType(dto.getUserType() != null ? dto.getUserType() : "passenger");
        user.setIsActive(true);
        user.setIsEmailVerified(false);
        return toDto(userRepository.save(user));
    }

    @Override
    public UserDto get(Long id) {
        return toDto(userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("User not found")));
    }

    @Override
    public List<UserDto> getAll() {
        return userRepository.findAll().stream().map(this::toDto).toList();
    }

    @Override
    public List<AdminUserDto> getAllForAdmin() {
        return jdbcTemplate.query("""
                SELECT
                    u.user_id,
                    u.first_name,
                    u.last_name,
                    u.email,
                    COALESCE(p.mobile_number, d.phone_number, cu.contact_phone) AS phone,
                    LOWER(u.user_type) AS user_type,
                    CASE
                        WHEN LOWER(u.user_type) = 'passenger' THEN COALESCE(p.status, IF(u.is_active, 'active', 'inactive'))
                        WHEN LOWER(u.user_type) = 'driver' THEN COALESCE(d.status, IF(u.is_active, 'active', 'inactive'))
                        WHEN LOWER(u.user_type) = 'corporate' THEN COALESCE(cu.status, IF(u.is_active, 'active', 'inactive'))
                        ELSE IF(u.is_active, 'active', 'inactive')
                    END AS status,
                    u.is_email_verified,
                    COALESCE(p.profile_photo, d.profile_photo, cu.profile_photo) AS profile_photo,
                    u.created_at,
                    d.license_number,
                    (SELECT b.bus_number FROM bus b WHERE b.driver_id = d.driver_id ORDER BY b.bus_id LIMIT 1) AS assigned_bus,
                    d.years_of_experience,
                    d.is_verified AS driver_verified,
                    d.average_rating AS driver_rating,
                    (SELECT COUNT(*) FROM trip_booking tb WHERE tb.driver_id = d.driver_id AND tb.booking_status <> 'cancelled') AS driver_trips,
                    (SELECT COUNT(*) FROM seat_booking sb WHERE sb.passenger_id = p.passenger_id) AS passenger_bookings,
                    (SELECT DATE_FORMAT(sb.journey_date, '%Y-%m-%d')
                     FROM seat_booking sb
                     WHERE sb.passenger_id = p.passenger_id
                     ORDER BY sb.journey_date DESC, sb.created_at DESC
                     LIMIT 1) AS last_trip_date,
                    (SELECT CONCAT(
                                COALESCE(NULLIF(sb.from_stop, ''), r.start_location),
                                ' to ',
                                COALESCE(NULLIF(sb.to_stop, ''), r.end_location))
                     FROM seat_booking sb
                     LEFT JOIN route r ON r.route_id = sb.route_id
                     WHERE sb.passenger_id = p.passenger_id
                     ORDER BY sb.journey_date DESC, sb.created_at DESC
                     LIMIT 1) AS last_route,
                    cu.company_name,
                    cu.business_registration_number,
                    cu.contact_person_name,
                    cu.contact_person_designation,
                    (SELECT COUNT(*) FROM corporate_contract cc
                     WHERE cc.corporate_user_id = cu.corporate_user_id AND cc.status = 'active') AS active_contracts,
                    (SELECT COALESCE(SUM(cc.billing_amount), 0) FROM corporate_contract cc
                     WHERE cc.corporate_user_id = cu.corporate_user_id AND cc.status <> 'cancelled') AS corporate_revenue
                FROM `user` u
                LEFT JOIN passenger p ON p.passenger_id = u.user_id
                LEFT JOIN driver d ON d.driver_id = u.user_id
                LEFT JOIN corporate_user cu ON cu.corporate_user_id = u.user_id
                WHERE LOWER(u.user_type) <> 'admin'
                ORDER BY u.created_at DESC, u.user_id DESC
                """, (rs, rowNum) -> new AdminUserDto(
                rs.getLong("user_id"),
                rs.getString("first_name"),
                rs.getString("last_name"),
                rs.getString("email"),
                rs.getString("phone"),
                rs.getString("user_type"),
                rs.getString("status"),
                rs.getBoolean("is_email_verified"),
                rs.getString("profile_photo"),
                rs.getTimestamp("created_at") != null
                        ? rs.getTimestamp("created_at").toLocalDateTime()
                        : null,
                rs.getString("license_number"),
                rs.getString("assigned_bus"),
                rs.getInt("years_of_experience"),
                rs.getBoolean("driver_verified"),
                rs.getBigDecimal("driver_rating"),
                rs.getLong("driver_trips"),
                rs.getLong("passenger_bookings"),
                rs.getString("last_trip_date"),
                rs.getString("last_route"),
                rs.getString("company_name"),
                rs.getString("business_registration_number"),
                rs.getString("contact_person_name"),
                rs.getString("contact_person_designation"),
                rs.getLong("active_contracts"),
                rs.getBigDecimal("corporate_revenue")
        ));
    }

    @Override
    public UserDto update(Long id, UserDto dto) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        user.setEmail(dto.getEmail());
        if (dto.getPassword() != null) {
            user.setPassword(passwordEncoder.encode(dto.getPassword()));
        }
        return toDto(userRepository.save(user));
    }

    @Override
    public void delete(Long id) {
        userRepository.deleteById(id);
    }

    private UserDto toDto(User user) {
        UserDto dto = new UserDto();
        dto.setId(user.getId());
        dto.setEmail(user.getEmail());
        dto.setUserType(user.getUserType());
        dto.setRole(user.getUserType());
        return dto;
    }
}

