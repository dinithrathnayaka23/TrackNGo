package com.trackngo.notification.internal.service;

import com.trackngo.notification.api.NotificationService;
import com.trackngo.notification.api.dto.NotificationDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Persists one notification in a transaction of its own.
 *
 * This exists so {@link com.trackngo.notification.api.NotificationDispatcher}
 * can catch write failures safely: joining the caller's transaction would mark
 * it rollback-only, and the caller's commit would then fail even though the
 * exception was handled.
 */
@Component
@RequiredArgsConstructor
public class NotificationWriter {

    private final NotificationService notificationService;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void write(NotificationDto dto) {
        notificationService.create(dto);
    }
}
