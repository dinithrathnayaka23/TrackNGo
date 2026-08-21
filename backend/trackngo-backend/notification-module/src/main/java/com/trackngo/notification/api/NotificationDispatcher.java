package com.trackngo.notification.api;

import com.trackngo.notification.api.dto.NotificationDto;
import com.trackngo.notification.internal.service.NotificationWriter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.function.Consumer;

/**
 * Fire-and-forget entry point other modules use to drop a notice into a user's
 * feed.
 *
 * Two properties make it safe to call from the middle of a business flow:
 *
 * - Delivery is deferred until the surrounding transaction commits, so a
 *   booking that rolls back never leaves a "Booking Confirmed" notice behind.
 * - Every failure is swallowed and logged, and the write runs in its own
 *   transaction, so a notification problem can never fail — or roll back — the
 *   booking, payment or complaint that triggered it.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class NotificationDispatcher {

    private final NotificationWriter writer;

    /** Sends a notice to a passenger's feed. Ignored when the passenger is unknown. */
    public void toPassenger(Long passengerId, NotificationType type, String title, String message) {
        if (passengerId == null) return;
        NotificationDto dto = build(type, title, message);
        dto.setPassengerId(passengerId);
        send(dto);
    }

    /** Sends a notice to a driver's feed. Ignored when the driver is unknown. */
    public void toDriver(Long driverId, NotificationType type, String title, String message) {
        if (driverId == null) return;
        NotificationDto dto = build(type, title, message);
        dto.setDriverId(driverId);
        send(dto);
    }

    /** Sends a notice to a corporate account's feed. Ignored when the account is unknown. */
    public void toCorporateUser(Long corporateUserId, NotificationType type, String title, String message) {
        if (corporateUserId == null) return;
        NotificationDto dto = build(type, title, message);
        dto.setCorporateUserId(corporateUserId);
        send(dto);
    }

    /** Sends a notice to an admin's feed. Ignored when the admin is unknown. */
    public void toAdmin(Long adminId, NotificationType type, String title, String message) {
        if (adminId == null) return;
        NotificationDto dto = build(type, title, message);
        dto.setAdminId(adminId);
        send(dto);
    }

    /**
     * Sends a notice to every active admin.
     *
     * Admin alerts are addressed to the operations team rather than to one
     * person, so this fans out to one row per admin. Use it only for events an
     * admin has to act on - anything routine would multiply across the team.
     */
    public void toAllAdmins(NotificationType type, String title, String message) {
        deliver(build(type, title, message), writer::writeForAllAdmins);
    }

    private NotificationDto build(NotificationType type, String title, String message) {
        NotificationDto dto = new NotificationDto();
        dto.setNotificationType(type.key());
        dto.setTitle(title);
        dto.setMessage(message);
        dto.setRead(false);
        return dto;
    }

    private void send(NotificationDto dto) {
        deliver(dto, writer::write);
    }

    private void deliver(NotificationDto dto, Consumer<NotificationDto> delivery) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    attempt(dto, delivery);
                }
            });
            return;
        }
        attempt(dto, delivery);
    }

    private void attempt(NotificationDto dto, Consumer<NotificationDto> delivery) {
        try {
            delivery.accept(dto);
        } catch (Exception ex) {
            log.warn(
                "Failed to create {} notification \"{}\"",
                dto.getNotificationType(),
                dto.getTitle(),
                ex
            );
        }
    }
}
