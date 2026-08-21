package com.trackngo.notification.internal.service;

import com.trackngo.notification.api.NotificationService;
import com.trackngo.notification.api.dto.NotificationDto;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

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
    private final JdbcTemplate jdbc;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void write(NotificationDto dto) {
        notificationService.create(dto);
    }

    /**
     * Writes one copy of a notice for every active admin.
     *
     * A notification row is addressed to a single admin, so an alert meant for
     * the operations team has to be stored once per admin rather than shared.
     * Inactive admins are skipped so a disabled account stops collecting work.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void writeForAllAdmins(NotificationDto template) {
        List<Long> adminIds = jdbc.queryForList(
            "SELECT admin_id FROM admin WHERE status = 'active'",
            Long.class
        );

        for (Long adminId : adminIds) {
            NotificationDto copy = new NotificationDto();
            copy.setNotificationType(template.getNotificationType());
            copy.setTitle(template.getTitle());
            copy.setMessage(template.getMessage());
            copy.setRead(false);
            copy.setAdminId(adminId);
            notificationService.create(copy);
        }
    }
}
