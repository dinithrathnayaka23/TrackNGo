
package com.trackngo.auth.api;

import com.trackngo.auth.api.dto.UserDto;
import com.trackngo.auth.api.dto.AdminUserDto;
import com.trackngo.auth.api.dto.AdminDriverDto;
import com.trackngo.auth.api.dto.SaveDriverRequest;
import com.trackngo.auth.api.dto.UpdateUserStatusRequest;

import java.util.List;

public interface UserService {
    UserDto create(UserDto dto);
    UserDto get(Long id);
    List<UserDto> getAll();
    List<AdminUserDto> getAllForAdmin();
    List<AdminDriverDto> getAllDrivers();
    AdminDriverDto getDriver(Long id);
    AdminDriverDto createDriver(SaveDriverRequest request);
    AdminDriverDto updateDriver(Long id, SaveDriverRequest request);
    UserDto update(Long id, UserDto dto);
    AdminUserDto updateStatus(Long id, UpdateUserStatusRequest request);
    void delete(Long id);
}

