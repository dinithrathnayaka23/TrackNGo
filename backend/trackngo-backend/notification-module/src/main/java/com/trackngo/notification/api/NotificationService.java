package com.trackngo.notification.api;

import com.trackngo.notification.api.dto.NotificationDto;

import java.util.List;

public interface NotificationService {
    NotificationDto create(NotificationDto dto);
    NotificationDto get(Long id);
    List<NotificationDto> getAll();
    List<NotificationDto> getPassengerNotifications(Long passengerId, String notificationType);
    NotificationDto update(Long id, NotificationDto dto);
    NotificationDto markRead(Long id);
    void markPassengerNotificationsRead(Long passengerId);
    void delete(Long id);
    void deletePassengerNotifications(Long passengerId);
}
