package com.trackngo.notification.api;

import com.trackngo.notification.api.dto.NotificationDto;

import java.util.List;

public interface NotificationService {
    NotificationDto create(NotificationDto dto);
    NotificationDto get(Long id);
    List<NotificationDto> getAll();
    NotificationDto update(Long id, NotificationDto dto);
    void delete(Long id);
}
