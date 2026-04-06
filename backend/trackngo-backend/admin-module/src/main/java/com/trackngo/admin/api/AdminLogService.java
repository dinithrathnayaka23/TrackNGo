package com.trackngo.admin.api;

import com.trackngo.admin.api.dto.AdminLogDto;

import java.util.List;

public interface AdminLogService {
    AdminLogDto create(AdminLogDto dto);
    AdminLogDto get(Long id);
    List<AdminLogDto> getAll();
    AdminLogDto update(Long id, AdminLogDto dto);
    void delete(Long id);
}
