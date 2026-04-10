
package com.trackngo.auth.internal.service;

import com.trackngo.auth.api.AuthService;
import com.trackngo.auth.api.dto.AuthRequest;
import com.trackngo.auth.api.dto.AuthResponse;
import com.trackngo.auth.events.UserRegisteredEvent;
import com.trackngo.auth.internal.entity.Role;
import com.trackngo.auth.internal.entity.User;
import com.trackngo.auth.internal.repository.RoleRepository;
import com.trackngo.auth.internal.repository.UserRepository;
import com.trackngo.commons.constants.Roles;
import com.trackngo.commons.events.EventPublisher;
import com.trackngo.commons.exception.BusinessException;
import com.trackngo.commons.util.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final EventPublisher eventPublisher;

    @Override
    public AuthResponse login(AuthRequest request) {
        User user = userRepository.findByUsername(request.getUsername())
            .orElseThrow(() -> new BusinessException("Invalid credentials"));
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new BusinessException("Invalid credentials");
        }
        String role = user.getRoles().stream().findFirst().map(Role::getName).orElse(Roles.ROLE_USER);
        String token = jwtUtil.generateToken(user.getUsername(), Map.of("role", role));
        return new AuthResponse(token);
    }

    @Override
    public AuthResponse register(AuthRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new BusinessException("Username already exists");
        }
        Role role = roleRepository.findByName(Roles.ROLE_USER)
            .orElseGet(() -> {
                Role r = new Role();
                r.setName(Roles.ROLE_USER);
                return roleRepository.save(r);
            });
        User user = new User();
        user.setUsername(request.getUsername());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.getRoles().add(role);
        User saved = userRepository.save(user);
        eventPublisher.publish(new UserRegisteredEvent(saved.getId()));
        String token = jwtUtil.generateToken(saved.getUsername(), Map.of("role", role.getName()));
        return new AuthResponse(token);
    }
}

