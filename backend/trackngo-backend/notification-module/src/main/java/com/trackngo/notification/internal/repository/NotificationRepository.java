package com.trackngo.notification.internal.repository;

import com.trackngo.notification.internal.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
}
