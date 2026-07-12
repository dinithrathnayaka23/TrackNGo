package com.trackngo.notification.internal.repository;

import com.trackngo.notification.internal.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findAllByOrderByCreatedAtDesc();

    List<Notification> findByPassengerIdOrderByCreatedAtDesc(Long passengerId);

    List<Notification> findByPassengerIdAndNotificationTypeOrderByCreatedAtDesc(
        Long passengerId,
        String notificationType
    );

    @Modifying
    @Query("update Notification n set n.read = true where n.passengerId = :passengerId")
    int markPassengerNotificationsRead(@Param("passengerId") Long passengerId);

    @Modifying
    @Query("delete from Notification n where n.passengerId = :passengerId")
    int deleteByPassengerId(@Param("passengerId") Long passengerId);
}
