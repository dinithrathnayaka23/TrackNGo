
package com.trackngo.auth.internal.service;

import com.trackngo.auth.api.AuthService;
import com.trackngo.auth.api.dto.AuthRequest;
import com.trackngo.auth.api.dto.AuthResponse;
import com.trackngo.auth.events.UserRegisteredEvent;
import com.trackngo.auth.internal.entity.User;
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
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final EventPublisher eventPublisher;

    @Override
    public AuthResponse login(AuthRequest request) {
        User user = userRepository.findByEmail(request.getIdentifier())
            .orElseThrow(() -> new BusinessException("Invalid credentials"));
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new BusinessException("Invalid credentials");
        }
        if (!"driver".equalsIgnoreCase(user.getUserType())) {
            throw new BusinessException("Access denied. Driver account required.");
        }
        String token = jwtUtil.generateToken(user.getEmail(), Map.of("role", user.getUserType(), "userType", user.getUserType()));
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
}

