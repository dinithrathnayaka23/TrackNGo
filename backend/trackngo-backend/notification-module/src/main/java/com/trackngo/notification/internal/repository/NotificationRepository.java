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

    List<Notification> findByPassengerIdAndNotificationTypeInOrderByCreatedAtDesc(
        Long passengerId,
        List<String> notificationTypes
    );

    List<Notification> findByDriverIdOrderByCreatedAtDesc(Long driverId);

    List<Notification> findByDriverIdAndNotificationTypeOrderByCreatedAtDesc(
        Long driverId,
        String notificationType
    );

    List<Notification> findByAdminIdOrderByCreatedAtDesc(Long adminId);

    List<Notification> findByAdminIdAndNotificationTypeOrderByCreatedAtDesc(
        Long adminId,
        String notificationType
    );

    @Modifying
    @Query("update Notification n set n.read = true where n.passengerId = :passengerId")
    int markPassengerNotificationsRead(@Param("passengerId") Long passengerId);

    @Modifying
    @Query("update Notification n set n.read = true where n.driverId = :driverId")
    int markDriverNotificationsRead(@Param("driverId") Long driverId);

    @Modifying
    @Query("update Notification n set n.read = true where n.adminId = :adminId")
    int markAdminNotificationsRead(@Param("adminId") Long adminId);

    @Modifying
    @Query("delete from Notification n where n.passengerId = :passengerId")
    int deleteByPassengerId(@Param("passengerId") Long passengerId);

    @Modifying
    @Query("delete from Notification n where n.driverId = :driverId")
    int deleteByDriverId(@Param("driverId") Long driverId);

    @Modifying
    @Query("delete from Notification n where n.adminId = :adminId")
    int deleteByAdminId(@Param("adminId") Long adminId);
}
