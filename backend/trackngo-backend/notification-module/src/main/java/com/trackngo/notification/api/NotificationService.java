package com.trackngo.notification.api;

import com.trackngo.notification.api.dto.NotificationDto;

import java.util.List;

public interface NotificationService {
    NotificationDto create(NotificationDto dto);
    NotificationDto get(Long id);
    List<NotificationDto> getAll();
    List<NotificationDto> getPassengerNotifications(Long passengerId, String notificationType);
    List<NotificationDto> getCorporateNotifications(Long corporateUserId, String notificationType);
    List<NotificationDto> getDriverNotifications(Long driverId, String notificationType);
    List<NotificationDto> getAdminNotifications(Long adminId, String notificationType);
    NotificationDto update(Long id, NotificationDto dto);
    NotificationDto markRead(Long id);
    void markPassengerNotificationsRead(Long passengerId);
    void markCorporateNotificationsRead(Long corporateUserId);
    void markDriverNotificationsRead(Long driverId);
    void markAdminNotificationsRead(Long adminId);
    void delete(Long id);
    void deletePassengerNotifications(Long passengerId);
    void deleteCorporateNotifications(Long corporateUserId);
    void deleteDriverNotifications(Long driverId);
    void deleteAdminNotifications(Long adminId);
}
