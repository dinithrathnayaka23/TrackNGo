
package com.trackngo.auth.api;

import com.trackngo.auth.api.dto.UserDto;

import java.util.List;

public interface UserService {
    UserDto create(UserDto dto);
    UserDto get(Long id);
    List<UserDto> getAll();
    UserDto update(Long id, UserDto dto);
    void delete(Long id);
}

