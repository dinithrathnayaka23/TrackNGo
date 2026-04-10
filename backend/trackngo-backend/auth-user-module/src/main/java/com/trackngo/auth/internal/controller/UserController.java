
package com.trackngo.auth.internal.controller;

import com.trackngo.auth.api.UserService;
import com.trackngo.auth.api.dto.UserDto;
import com.trackngo.commons.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;

    @PostMapping
    public ApiResponse<UserDto> create(@Valid @RequestBody UserDto dto) {
        return ApiResponse.ok("User created", userService.create(dto));
    }

    @GetMapping("/{id}")
    public ApiResponse<UserDto> get(@PathVariable Long id) {
        return ApiResponse.ok("User fetched", userService.get(id));
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<UserDto>> getAll() {
        return ApiResponse.ok("Users fetched", userService.getAll());
    }

    @PutMapping("/{id}")
    public ApiResponse<UserDto> update(@PathVariable Long id, @Valid @RequestBody UserDto dto) {
        return ApiResponse.ok("User updated", userService.update(id, dto));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        userService.delete(id);
        return ApiResponse.ok("User deleted", null);
    }
}

