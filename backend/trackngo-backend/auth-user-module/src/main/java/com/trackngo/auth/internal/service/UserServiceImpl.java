
package com.trackngo.auth.internal.service;

import com.trackngo.auth.api.UserService;
import com.trackngo.auth.api.dto.UserDto;
import com.trackngo.auth.api.dto.AdminUserDto;
import com.trackngo.auth.api.dto.AdminDriverDto;
import com.trackngo.auth.api.dto.SaveDriverRequest;
import com.trackngo.auth.api.dto.UpdateUserStatusRequest;
import com.trackngo.auth.internal.entity.User;
import com.trackngo.auth.internal.repository.UserRepository;
import com.trackngo.commons.exception.BusinessException;
import com.trackngo.commons.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalDate;
import java.util.Locale;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {
    private static final Pattern NAME_PATTERN = Pattern.compile("^[\\p{L}][\\p{L} .'-]*$");
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final Pattern PHONE_PATTERN = Pattern.compile("^0[0-9]{9}$");
    private static final Pattern LICENSE_PATTERN = Pattern.compile("^B[0-9]{7}$");
    private static final Pattern ACCOUNT_PATTERN = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9 -]{3,33}$");
    private static final Pattern BANK_PATTERN = Pattern.compile("^[\\p{L}][\\p{L} .&'-]*$");

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
    public List<AdminDriverDto> getAllDrivers() {
        return jdbcTemplate.query(driverQuery() + " ORDER BY u.created_at DESC, u.user_id DESC", this::mapAdminDriver);
    }

    @Override
    public AdminDriverDto getDriver(Long id) {
        List<AdminDriverDto> drivers = jdbcTemplate.query(
                driverQuery() + " WHERE d.driver_id = ?",
                this::mapAdminDriver,
                id
        );
        if (drivers.isEmpty()) {
            throw new ResourceNotFoundException("Driver not found");
        }
        return drivers.get(0);
    }

    @Override
    @Transactional
    public AdminDriverDto createDriver(SaveDriverRequest request) {
        if (request.password() == null || request.password().isBlank()) {
            throw new BusinessException("An initial password is required when creating a driver.");
        }
        validatePassword(request.password());
        String rawEmail = clean(request.email());
        final String email = rawEmail == null ? null : rawEmail.toLowerCase(Locale.ROOT);
        String phone = clean(request.phoneNumber());
        String licenseNumber = clean(request.licenseNumber());
        String status = normalizeDriverStatus(request.status());
        validateDriverFields(request, email, phone, licenseNumber, status);
        ensureUniqueDriverFields(email, phone, licenseNumber, null);

        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO `user` (first_name, last_name, email, password, user_type, is_email_verified, is_active) " +
                            "VALUES (?, ?, ?, ?, 'driver', false, ?)",
                    Statement.RETURN_GENERATED_KEYS
            );
            statement.setString(1, clean(request.firstName()));
            statement.setString(2, clean(request.lastName()));
            statement.setString(3, email);
            statement.setString(4, passwordEncoder.encode(request.password()));
            statement.setBoolean(5, isActiveStatus(status));
            return statement;
        }, keyHolder);

        Number generatedId = keyHolder.getKey();
        if (generatedId == null) {
            throw new BusinessException("The driver account could not be created.");
        }

        Long driverId = generatedId.longValue();
        jdbcTemplate.update(
                "INSERT INTO driver (driver_id, licence_expiry, years_of_experience, profile_photo, account_number, " +
                        "bank_name, phone_number, is_phone_verified, license_number, driver_earnings, status, " +
                        "is_verified, average_rating, joined_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0, ?)",
                driverId,
                request.licenceExpiry(),
                defaultInt(request.yearsOfExperience()),
                clean(request.profilePhoto()),
                clean(request.accountNumber()),
                clean(request.bankName()),
                phone,
                Boolean.TRUE.equals(request.isPhoneVerified()),
                licenseNumber,
                status,
                Boolean.TRUE.equals(request.isVerified()),
                request.joinedDate() != null ? request.joinedDate() : LocalDate.now()
        );
        return getDriver(driverId);
    }

    @Override
    @Transactional
    public AdminDriverDto updateDriver(Long id, SaveDriverRequest request) {
        getDriver(id);

        String email = clean(request.email());
        email = email == null ? null : email.toLowerCase(Locale.ROOT);
        String phone = clean(request.phoneNumber());
        String licenseNumber = clean(request.licenseNumber());
        String status = normalizeDriverStatus(request.status());
        validateDriverFields(request, email, phone, licenseNumber, status);
        ensureUniqueDriverFields(email, phone, licenseNumber, id);

        jdbcTemplate.update(
                "UPDATE `user` SET first_name = ?, last_name = ?, email = ?, is_active = ? WHERE user_id = ?",
                clean(request.firstName()),
                clean(request.lastName()),
                email,
                isActiveStatus(status),
                id
        );
        if (request.password() != null && !request.password().isBlank()) {
            validatePassword(request.password());
            jdbcTemplate.update(
                    "UPDATE `user` SET password = ? WHERE user_id = ?",
                    passwordEncoder.encode(request.password()),
                    id
            );
        }
        jdbcTemplate.update(
                "UPDATE driver SET licence_expiry = ?, years_of_experience = ?, account_number = ?, bank_name = ?, " +
                        "phone_number = ?, is_phone_verified = ?, license_number = ?, status = ?, is_verified = ?, " +
                        "joined_date = ?, profile_photo = COALESCE(?, profile_photo) WHERE driver_id = ?",
                request.licenceExpiry(),
                defaultInt(request.yearsOfExperience()),
                clean(request.accountNumber()),
                clean(request.bankName()),
                phone,
                Boolean.TRUE.equals(request.isPhoneVerified()),
                licenseNumber,
                status,
                Boolean.TRUE.equals(request.isVerified()),
                request.joinedDate() != null ? request.joinedDate() : LocalDate.now(),
                clean(request.profilePhoto()),
                id
        );
        return getDriver(id);
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
    @Transactional
    public AdminUserDto updateStatus(Long id, UpdateUserStatusRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        String status = clean(request.status());
        if (status == null) {
            throw new BusinessException("Status is required.");
        }
        status = status.toLowerCase(Locale.ROOT);
        if (!Set.of("active", "suspended").contains(status)) {
            throw new BusinessException("Status must be active or suspended.");
        }

        boolean active = "active".equals(status);
        jdbcTemplate.update("UPDATE `user` SET is_active = ? WHERE user_id = ?", active, id);
        switch (normalizeUserType(user.getUserType())) {
            case "passenger" -> jdbcTemplate.update("UPDATE passenger SET status = ? WHERE passenger_id = ?", status, id);
            case "driver" -> jdbcTemplate.update("UPDATE driver SET status = ? WHERE driver_id = ?", status, id);
            case "corporate" -> jdbcTemplate.update("UPDATE corporate_user SET status = ? WHERE corporate_user_id = ?", status, id);
            default -> { }
        }
        return getAllForAdmin().stream()
                .filter(item -> item.id().equals(id))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    private String driverQuery() {
        return """
                SELECT u.user_id AS id, u.first_name, u.last_name, u.email,
                       d.phone_number, d.profile_photo, d.license_number, d.licence_expiry,
                       d.years_of_experience, d.account_number, d.bank_name, d.status,
                       d.is_verified, d.is_phone_verified, d.joined_date,
                       d.driver_earnings, d.average_rating,
                       (SELECT COUNT(*) FROM trip_booking tb
                        WHERE tb.driver_id = d.driver_id AND tb.booking_status <> 'cancelled') AS driver_trips,
                       (SELECT b.bus_id FROM bus b WHERE b.driver_id = d.driver_id ORDER BY b.bus_id LIMIT 1) AS assigned_bus_id,
                       (SELECT b.bus_number FROM bus b WHERE b.driver_id = d.driver_id ORDER BY b.bus_id LIMIT 1) AS assigned_bus
                FROM `user` u
                JOIN driver d ON d.driver_id = u.user_id
                """;
    }

    private AdminDriverDto mapAdminDriver(ResultSet rs, int rowNum) throws SQLException {
        return new AdminDriverDto(
                rs.getLong("id"),
                rs.getString("first_name"),
                rs.getString("last_name"),
                rs.getString("email"),
                rs.getString("phone_number"),
                rs.getString("profile_photo"),
                rs.getString("license_number"),
                toLocalDate(rs, "licence_expiry"),
                rs.getObject("years_of_experience", Integer.class),
                rs.getString("account_number"),
                rs.getString("bank_name"),
                rs.getString("status"),
                rs.getObject("is_verified", Boolean.class),
                rs.getObject("is_phone_verified", Boolean.class),
                toLocalDate(rs, "joined_date"),
                rs.getBigDecimal("driver_earnings"),
                rs.getBigDecimal("average_rating"),
                rs.getLong("driver_trips"),
                nullableLong(rs, "assigned_bus_id"),
                rs.getString("assigned_bus")
        );
    }

    private void ensureUniqueDriverFields(String email, String phone, String licenseNumber, Long excludedId) {
        int emailCount = excludedId == null
                ? jdbcTemplate.queryForObject("SELECT COUNT(*) FROM `user` WHERE LOWER(email) = LOWER(?)", Integer.class, email)
                : jdbcTemplate.queryForObject("SELECT COUNT(*) FROM `user` WHERE LOWER(email) = LOWER(?) AND user_id <> ?", Integer.class, email, excludedId);
        if (emailCount > 0) {
            throw new BusinessException("That email address is already in use.");
        }

        int phoneCount = excludedId == null
                ? jdbcTemplate.queryForObject("SELECT COUNT(*) FROM driver WHERE phone_number = ?", Integer.class, phone)
                : jdbcTemplate.queryForObject("SELECT COUNT(*) FROM driver WHERE phone_number = ? AND driver_id <> ?", Integer.class, phone, excludedId);
        if (phoneCount > 0) {
            throw new BusinessException("That phone number is already assigned to another driver.");
        }

        int licenseCount = excludedId == null
                ? jdbcTemplate.queryForObject("SELECT COUNT(*) FROM driver WHERE license_number = ?", Integer.class, licenseNumber)
                : jdbcTemplate.queryForObject("SELECT COUNT(*) FROM driver WHERE license_number = ? AND driver_id <> ?", Integer.class, licenseNumber, excludedId);
        if (licenseCount > 0) {
            throw new BusinessException("That license number is already assigned to another driver.");
        }
    }

    private void validateDriverFields(
            SaveDriverRequest request,
            String email,
            String phone,
            String licenseNumber,
            String status
    ) {
        String firstName = clean(request.firstName());
        String lastName = clean(request.lastName());
        if (firstName == null || firstName.length() > 80 || !NAME_PATTERN.matcher(firstName).matches()) {
            throw new BusinessException("First name may contain letters, spaces, apostrophes, periods, or hyphens only.");
        }
        if (lastName != null && (lastName.length() > 80 || !NAME_PATTERN.matcher(lastName).matches())) {
            throw new BusinessException("Last name may contain letters, spaces, apostrophes, periods, or hyphens only.");
        }
        if (email == null || email.length() > 254 || !EMAIL_PATTERN.matcher(email).matches()) {
            throw new BusinessException("Enter a valid email address.");
        }
        if (phone == null || !PHONE_PATTERN.matcher(phone).matches()) {
            throw new BusinessException("Phone number must start with 0 and contain exactly 10 digits.");
        }
        if (licenseNumber == null
                || !LICENSE_PATTERN.matcher(licenseNumber).matches()) {
            throw new BusinessException("License number must start with B followed by exactly 7 digits.");
        }
        if (request.licenceExpiry() == null || request.licenceExpiry().isBefore(LocalDate.now())) {
            throw new BusinessException("License expiry cannot be in the past.");
        }
        Integer experience = request.yearsOfExperience();
        if (experience == null || experience < 0 || experience > 60) {
            throw new BusinessException("Years of experience must be between 0 and 60.");
        }
        if (request.joinedDate() != null && request.joinedDate().isAfter(LocalDate.now())) {
            throw new BusinessException("Joined date cannot be in the future.");
        }
        String accountNumber = clean(request.accountNumber());
        if (accountNumber != null && (accountNumber.length() < 4 || accountNumber.length() > 34
                || !ACCOUNT_PATTERN.matcher(accountNumber).matches())) {
            throw new BusinessException("Bank account number must be 4-34 letters or numbers, with spaces or hyphens allowed.");
        }
        String bankName = clean(request.bankName());
        if (bankName != null && (bankName.length() > 100 || !BANK_PATTERN.matcher(bankName).matches())) {
            throw new BusinessException("Bank name contains invalid characters.");
        }
        if (!Set.of("active", "inactive", "on_leave", "suspended").contains(status)) {
            throw new BusinessException("Unsupported driver status.");
        }
        String profilePhoto = clean(request.profilePhoto());
        if (profilePhoto != null && profilePhoto.length() > 500) {
            throw new BusinessException("Profile photo URL is too long.");
        }
    }

    private String normalizeDriverStatus(String status) {
        String normalized = clean(status);
        if (normalized == null) {
            return "active";
        }
        normalized = normalized.toLowerCase(Locale.ROOT);
        if (!Set.of("active", "inactive", "on_leave", "suspended").contains(normalized)) {
            throw new BusinessException("Unsupported driver status.");
        }
        return normalized;
    }

    private String normalizeUserType(String userType) {
        if (userType == null) {
            return "";
        }
        String normalized = userType.trim().toLowerCase(Locale.ROOT);
        return "corporate_user".equals(normalized) ? "corporate" : normalized;
    }

    private boolean isActiveStatus(String status) {
        return "active".equalsIgnoreCase(status);
    }

    private void validatePassword(String password) {
        if (password.length() < 6) {
            throw new BusinessException("Password must contain at least 6 characters.");
        }
    }

    private int defaultInt(Integer value) {
        return value == null ? 0 : value;
    }

    private LocalDate toLocalDate(ResultSet rs, String column) throws SQLException {
        java.sql.Date date = rs.getDate(column);
        return date == null ? null : date.toLocalDate();
    }

    private Long nullableLong(ResultSet rs, String column) throws SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }

    private String clean(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
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

