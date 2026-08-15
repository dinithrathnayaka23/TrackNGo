
package com.trackngo.auth.api;

import com.trackngo.auth.api.dto.UserDto;
import com.trackngo.auth.api.dto.AdminUserDto;

import java.util.List;

public interface UserService {
    UserDto create(UserDto dto);
    UserDto get(Long id);
    List<UserDto> getAll();
    List<AdminUserDto> getAllForAdmin();
    UserDto update(Long id, UserDto dto);
    void delete(Long id);
}

