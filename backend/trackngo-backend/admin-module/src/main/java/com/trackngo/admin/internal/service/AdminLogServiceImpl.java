package com.trackngo.admin.internal.service;

import com.trackngo.admin.api.AdminLogService;
import com.trackngo.admin.api.dto.AdminLogDto;
import com.trackngo.admin.events.AdminLogCreatedEvent;
import com.trackngo.admin.internal.entity.AdminLog;
import com.trackngo.admin.internal.repository.AdminLogRepository;
import com.trackngo.commons.events.EventPublisher;
import com.trackngo.commons.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminLogServiceImpl implements AdminLogService {
    private final AdminLogRepository repository;
    private final EventPublisher eventPublisher;

    @Override
    public AdminLogDto create(AdminLogDto dto) {
        AdminLog entity = new AdminLog();
        entity.setName(dto.getName());
        AdminLog saved = repository.save(entity);
        eventPublisher.publish(new AdminLogCreatedEvent(saved.getId()));
        return toDto(saved);
    }

    @Override
    public AdminLogDto get(Long id) {
        return toDto(repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("AdminLog not found")));
    }

    @Override
    public List<AdminLogDto> getAll() {
        return repository.findAll().stream().map(this::toDto).toList();
    }

    @Override
    public AdminLogDto update(Long id, AdminLogDto dto) {
        AdminLog entity = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("AdminLog not found"));
        entity.setName(dto.getName());
        return toDto(repository.save(entity));
    }

    @Override
    public void delete(Long id) {
        repository.deleteById(id);
    }

    private AdminLogDto toDto(AdminLog entity) {
        AdminLogDto dto = new AdminLogDto();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        return dto;
    }
}
