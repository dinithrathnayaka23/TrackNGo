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
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@Transactional
public class NotificationServiceImpl implements NotificationService {
    private final NotificationRepository repository;
    private final EventPublisher eventPublisher;

    @Override
    public NotificationDto create(NotificationDto dto) {
        Notification entity = new Notification();
        applyDto(entity, dto);
        Notification saved = repository.save(entity);
        eventPublisher.publish(new NotificationCreatedEvent(saved.getId()));
        return toDto(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public NotificationDto get(Long id) {
        return toDto(findNotification(id));
    }

    @Override
    @Transactional(readOnly = true)
    public List<NotificationDto> getAll() {
        return repository.findAllByOrderByCreatedAtDesc().stream().map(this::toDto).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<NotificationDto> getPassengerNotifications(Long passengerId, String notificationType) {
        if (notificationType == null || notificationType.isBlank()) {
            return repository.findByPassengerIdOrderByCreatedAtDesc(passengerId)
                .stream()
                .map(this::toDto)
                .toList();
        }

        // Cancellation notices belong in the mobile Bookings category too.
        // Keep the public filter name as "booking" while returning both the
        // original booking notices and disruption cancellations.
        if ("booking".equalsIgnoreCase(notificationType.trim())) {
            return repository.findByPassengerIdAndNotificationTypeInOrderByCreatedAtDesc(
                    passengerId,
                    List.of("booking", "cancellation")
                )
                .stream()
                .map(this::toDto)
                .toList();
        }

        return repository.findByPassengerIdAndNotificationTypeOrderByCreatedAtDesc(
                passengerId,
                notificationType.trim().toLowerCase(Locale.ROOT)
            )
            .stream()
            .map(this::toDto)
            .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<NotificationDto> getDriverNotifications(Long driverId, String notificationType) {
        if (notificationType == null || notificationType.isBlank()) {
            return repository.findByDriverIdOrderByCreatedAtDesc(driverId)
                .stream()
                .map(this::toDto)
                .toList();
        }

        return repository.findByDriverIdAndNotificationTypeOrderByCreatedAtDesc(
                driverId,
                notificationType.trim().toLowerCase(Locale.ROOT)
            )
            .stream()
            .map(this::toDto)
            .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<NotificationDto> getAdminNotifications(Long adminId, String notificationType) {
        if (notificationType == null || notificationType.isBlank()) {
            return repository.findByAdminIdOrderByCreatedAtDesc(adminId)
                .stream()
                .map(this::toDto)
                .toList();
        }

        return repository.findByAdminIdAndNotificationTypeOrderByCreatedAtDesc(
                adminId,
                notificationType.trim().toLowerCase(Locale.ROOT)
            )
            .stream()
            .map(this::toDto)
            .toList();
    }

    @Override
    public NotificationDto update(Long id, NotificationDto dto) {
        Notification entity = findNotification(id);
        applyDto(entity, dto);
        return toDto(repository.save(entity));
    }

    @Override
    public NotificationDto markRead(Long id) {
        Notification entity = findNotification(id);
        entity.setRead(true);
        return toDto(repository.save(entity));
    }

    @Override
    public void markPassengerNotificationsRead(Long passengerId) {
        repository.markPassengerNotificationsRead(passengerId);
    }

    @Override
    public void markDriverNotificationsRead(Long driverId) {
        repository.markDriverNotificationsRead(driverId);
    }

    @Override
    public void markAdminNotificationsRead(Long adminId) {
        repository.markAdminNotificationsRead(adminId);
    }

    @Override
    public void delete(Long id) {
        if (!repository.existsById(id)) {
            throw new ResourceNotFoundException("Notification not found");
        }
        repository.deleteById(id);
    }

    @Override
    public void deletePassengerNotifications(Long passengerId) {
        repository.deleteByPassengerId(passengerId);
    }

    @Override
    public void deleteDriverNotifications(Long driverId) {
        repository.deleteByDriverId(driverId);
    }

    @Override
    public void deleteAdminNotifications(Long adminId) {
        repository.deleteByAdminId(adminId);
    }

    private Notification findNotification(Long id) {
        return repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Notification not found"));
    }

    private void applyDto(Notification entity, NotificationDto dto) {
        entity.setNotificationType(dto.getNotificationType().trim().toLowerCase(Locale.ROOT));
        entity.setTitle(dto.getTitle());
        entity.setMessage(dto.getMessage());
        entity.setRead(dto.getRead() != null ? dto.getRead() : Boolean.FALSE);
        entity.setPassengerId(dto.getPassengerId());
        entity.setCorporateUserId(dto.getCorporateUserId());
        entity.setDriverId(dto.getDriverId());
        entity.setAdminId(dto.getAdminId());
    }

    private NotificationDto toDto(Notification entity) {
        NotificationDto dto = new NotificationDto();
        dto.setId(entity.getId());
        dto.setNotificationType(entity.getNotificationType());
        dto.setTitle(entity.getTitle());
        dto.setMessage(entity.getMessage());
        dto.setRead(Boolean.TRUE.equals(entity.getRead()));
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setPassengerId(entity.getPassengerId());
        dto.setCorporateUserId(entity.getCorporateUserId());
        dto.setDriverId(entity.getDriverId());
        dto.setAdminId(entity.getAdminId());
        return dto;
    }
}
