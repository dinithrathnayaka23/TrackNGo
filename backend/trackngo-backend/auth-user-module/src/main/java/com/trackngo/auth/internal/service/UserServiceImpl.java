
package com.trackngo.auth.internal.service;

import com.trackngo.auth.api.UserService;
import com.trackngo.auth.api.dto.UserDto;
import com.trackngo.auth.internal.entity.Role;
import com.trackngo.auth.internal.entity.User;
import com.trackngo.auth.internal.repository.RoleRepository;
import com.trackngo.auth.internal.repository.UserRepository;
import com.trackngo.commons.constants.Roles;
import com.trackngo.commons.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public UserDto create(UserDto dto) {
        User user = new User();
        user.setUsername(dto.getUsername());
        if (dto.getPassword() != null) {
            user.setPassword(passwordEncoder.encode(dto.getPassword()));
        }
        String roleName = dto.getRole() == null ? Roles.ROLE_USER : dto.getRole();
        Role role = roleRepository.findByName(roleName)
            .orElseGet(() -> {
                Role r = new Role();
                r.setName(roleName);
                return roleRepository.save(r);
            });
        user.getRoles().add(role);
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
    public UserDto update(Long id, UserDto dto) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        user.setUsername(dto.getUsername());
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
        dto.setUsername(user.getUsername());
        dto.setRole(user.getRoles().stream().findFirst().map(Role::getName).orElse(Roles.ROLE_USER));
        return dto;
    }
}

