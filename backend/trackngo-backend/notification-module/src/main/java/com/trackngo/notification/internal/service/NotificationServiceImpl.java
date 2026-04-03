package com.trackngo.notification.internal.service;

import com.trackngo.notification.api.NotificationService;
import com.trackngo.notification.api.dto.NotificationDto;
import com.trackngo.notification.events.NotificationCreatedEvent;
import com.trackngo.notification.internal.entity.Notification;
import com.trackngo.notification.internal.repository.NotificationRepository;
import com.trackngo.commons.events.EventPublisher;
import com.trackngo.commons.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationServiceImpl implements NotificationService {
    private final NotificationRepository repository;
    private final EventPublisher eventPublisher;

    @Override
    public NotificationDto create(NotificationDto dto) {
        Notification entity = new Notification();
        entity.setName(dto.getName());
        Notification saved = repository.save(entity);
        eventPublisher.publish(new NotificationCreatedEvent(saved.getId()));
        return toDto(saved);
    }

    @Override
    public NotificationDto get(Long id) {
        return toDto(repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Notification not found")));
    }

    @Override
    public List<NotificationDto> getAll() {
        return repository.findAll().stream().map(this::toDto).toList();
    }

    @Override
    public NotificationDto update(Long id, NotificationDto dto) {
        Notification entity = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Notification not found"));
        entity.setName(dto.getName());
        return toDto(repository.save(entity));
    }

    @Override
    public void delete(Long id) {
        repository.deleteById(id);
    }

    private NotificationDto toDto(Notification entity) {
        NotificationDto dto = new NotificationDto();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        return dto;
    }
}
