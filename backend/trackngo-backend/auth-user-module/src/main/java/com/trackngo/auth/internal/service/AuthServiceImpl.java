
package com.trackngo.auth.internal.service;

import com.trackngo.auth.api.AuthService;
import com.trackngo.auth.api.dto.AdminRegisterRequest;
import com.trackngo.auth.api.dto.AuthRequest;
import com.trackngo.auth.api.dto.AuthResponse;
import com.trackngo.auth.events.UserRegisteredEvent;
import com.trackngo.auth.internal.entity.Admin;
import com.trackngo.auth.internal.entity.User;
import com.trackngo.auth.internal.repository.AdminRepository;
import com.trackngo.auth.internal.repository.UserRepository;
import com.trackngo.commons.events.EventPublisher;
import com.trackngo.commons.exception.BusinessException;
import com.trackngo.commons.util.JwtUtil; // import JwtUtil
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {
    private final UserRepository userRepository;
    private final AdminRepository adminRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final EventPublisher eventPublisher;

    @Override
    public AuthResponse login(AuthRequest request) {
        User user = userRepository.findByIdentifier(request.getIdentifier().trim())
            .orElseThrow(() -> new BusinessException("Invalid credentials"));
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new BusinessException("Invalid credentials");
        }
        if (Boolean.FALSE.equals(user.getIsActive())) {
            throw new BusinessException("Account is inactive.");
        }

        String requestedUserType = normalizeUserType(request.getExpectedUserType());
        String actualUserType = normalizeUserType(user.getUserType());

        if (requestedUserType != null && !requestedUserType.equals(actualUserType)) {
            throw new BusinessException("Access denied. " + toDisplayRole(requestedUserType) + " account required.");
        }

        String token = jwtUtil.generateToken(
                user.getEmail(),
                Map.of("role", actualUserType, "userType", actualUserType)
        );
        return new AuthResponse(token, user.getId(), user.getUserType(), user.getEmail(), user.getFirstName(), user.getLastName());
    }


    @Override
    public AuthResponse register(AuthRequest request) {
        if (userRepository.existsByEmail(request.getIdentifier())) {
            throw new BusinessException("Email already exists");
        }
        User user = new User();
        user.setEmail(request.getIdentifier());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setUserType("passenger");
        user.setIsActive(true);
        user.setIsEmailVerified(false);
        User saved = userRepository.save(user);
        eventPublisher.publish(new UserRegisteredEvent(saved.getId()));
        String token = jwtUtil.generateToken(saved.getEmail(), Map.of("role", saved.getUserType(), "userType", saved.getUserType()));
        return new AuthResponse(token, saved.getId(), saved.getUserType(), saved.getEmail(), saved.getFirstName(), saved.getLastName());
    }

    @Override
    public void registerAdmin(AdminRegisterRequest request) {
        String email = request.getEmail().trim();
        String phone = request.getPhone().trim();
        String employeeId = request.getEmployeeId().trim();

        userRepository.findByEmail(email).ifPresent(existing -> {
            if ("admin".equalsIgnoreCase(existing.getUserType())) {
                throw new BusinessException("This email is already registered as an admin. Please log in instead.");
            }
            throw new BusinessException("This email is already associated with another account.");
        });

        if (adminRepository.existsByPhoneNumber(phone)) {
            throw new BusinessException("This phone number is already registered to an admin account.");
        }

        if (adminRepository.existsByEmployeeId(employeeId)) {
            throw new BusinessException("This Employee ID is already registered.");
        }

        String[] nameParts = request.getFullName().trim().split("\\s+", 2);
        String firstName = nameParts[0];
        String lastName = nameParts.length > 1 ? nameParts[1] : null;

        User user = new User();
        user.setFirstName(firstName);
        user.setLastName(lastName);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setUserType("admin");
        user.setIsActive(true);
        user.setIsEmailVerified(false);
        User savedUser = userRepository.save(user);

        Admin admin = new Admin();
        admin.setAdminId(savedUser.getId());
        admin.setPhoneNumber(phone);
        admin.setEmployeeId(employeeId);
        admin.setRole("moderator");
        admin.setStatus("active");
        adminRepository.save(admin);

        eventPublisher.publish(new UserRegisteredEvent(savedUser.getId()));
    }

    private String normalizeUserType(String userType) {
        if (userType == null || userType.isBlank()) {
            return null;
        }

        String normalized = userType.trim().toLowerCase();
        return switch (normalized) {
            case "passenger" -> "passenger";
            case "driver" -> "driver";
            case "admin" -> "admin";
            case "corporate", "corporate_user" -> "corporate";
            default -> normalized;
        };
    }

    private String toDisplayRole(String userType) {
        return switch (userType) {
            case "passenger" -> "Passenger";
            case "driver" -> "Driver";
            case "admin" -> "Admin";
            case "corporate" -> "Corporate";
            default -> userType;
        };
    }
}

