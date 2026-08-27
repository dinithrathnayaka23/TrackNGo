package com.trackngo.notification.internal.service;

import com.trackngo.commons.exception.BusinessException;
import com.trackngo.notification.api.NotificationBroadcastService;
import com.trackngo.notification.api.NotificationType;
import com.trackngo.notification.api.dto.AudienceCountsDto;
import com.trackngo.notification.api.dto.BroadcastNotificationRequest;
import com.trackngo.notification.api.dto.BroadcastResultDto;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class NotificationBroadcastServiceImpl implements NotificationBroadcastService {

    /**
     * Who a broadcast can reach: an account that can still be signed into and has not
     * been suspended. One rule across all three audiences, so "who got this?" has a
     * single answer an administrator can be told.
     */
    private static final String PASSENGER_IDS_SQL = """
            SELECT p.passenger_id FROM passenger p
            JOIN `user` u ON u.user_id = p.passenger_id
            WHERE u.is_active = TRUE AND p.status <> 'suspended'
            """;

    private static final String DRIVER_IDS_SQL = """
            SELECT d.driver_id FROM driver d
            JOIN `user` u ON u.user_id = d.driver_id
            WHERE u.is_active = TRUE AND d.status <> 'suspended'
            """;

    private static final String CORPORATE_IDS_SQL = """
            SELECT c.corporate_user_id FROM corporate_user c
            JOIN `user` u ON u.user_id = c.corporate_user_id
            WHERE u.is_active = TRUE AND c.status <> 'suspended'
            """;

    private static final String PASSENGERS = "passengers";
    private static final String DRIVERS = "drivers";
    private static final String CORPORATE = "corporate";

    /**
     * Broadcasts an administrator can raise. Categories that describe something that
     * happened to one person - a payment, a rating, a cancellation - are left out
     * because they read as nonsense when addressed to everybody.
     */
    private static final Set<String> ALLOWED_TYPES = Set.of(
            NotificationType.SYSTEM_ALERT.key(),
            NotificationType.PROMOTION.key(),
            NotificationType.JOURNEY.key()
    );

    private final JdbcTemplate jdbcTemplate;

    @Override
    @Transactional(readOnly = true)
    public AudienceCountsDto getAudienceCounts() {
        return new AudienceCountsDto(
                count(PASSENGER_IDS_SQL),
                count(DRIVER_IDS_SQL),
                count(CORPORATE_IDS_SQL)
        );
    }

    @Override
    @Transactional
    public BroadcastResultDto broadcast(BroadcastNotificationRequest request) {
        String type = normalizeType(request.getNotificationType());
        String title = requireText(request.getTitle(), "Title is required.");
        String message = requireText(request.getMessage(), "Message is required.");
        Set<String> audiences = normalizeAudiences(request.getAudiences());

        long passengers = audiences.contains(PASSENGERS)
                ? send(PASSENGER_IDS_SQL, "passenger_id", type, title, message) : 0;
        long drivers = audiences.contains(DRIVERS)
                ? send(DRIVER_IDS_SQL, "driver_id", type, title, message) : 0;
        long corporate = audiences.contains(CORPORATE)
                ? send(CORPORATE_IDS_SQL, "corporate_user_id", type, title, message) : 0;

        return BroadcastResultDto.of(passengers, drivers, corporate);
    }

    private long count(String idsSql) {
        Long total = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM (" + idsSql + ") AS reachable",
                Long.class
        );
        return total == null ? 0 : total;
    }

    /**
     * Writes one row per recipient in a single batch.
     *
     * A notification row belongs to one account, so reaching an audience means writing
     * as many rows as it has members. That is done as a batch rather than through
     * {@link com.trackngo.notification.api.NotificationService#create} because an
     * audience can run to thousands and an administrator is waiting on the response.
     * Nothing subscribes to NotificationCreatedEvent today, so skipping it changes no
     * behaviour; a future real-time push would need to fan out from here as well.
     */
    private long send(String idsSql, String recipientColumn, String type, String title, String message) {
        List<Long> recipientIds = jdbcTemplate.queryForList(idsSql, Long.class);
        if (recipientIds.isEmpty()) {
            return 0;
        }

        // recipientColumn is a constant chosen in this class, never caller input.
        String insert = "INSERT INTO notification (notification_type, title, message, is_read, "
                + recipientColumn + ") VALUES (?, ?, ?, FALSE, ?)";

        jdbcTemplate.batchUpdate(insert, recipientIds.stream()
                .map(id -> new Object[]{type, title, message, id})
                .toList());

        return recipientIds.size();
    }

    private String normalizeType(String notificationType) {
        String normalized = notificationType == null
                ? ""
                : notificationType.trim().toLowerCase(Locale.ROOT);
        if (!ALLOWED_TYPES.contains(normalized)) {
            throw new BusinessException(
                    "Unsupported notification category. Allowed: " + String.join(", ", ALLOWED_TYPES) + "."
            );
        }
        return normalized;
    }

    private Set<String> normalizeAudiences(List<String> audiences) {
        if (audiences == null || audiences.isEmpty()) {
            throw new BusinessException("Choose at least one audience.");
        }

        Set<String> normalized = new LinkedHashSet<>();
        for (String audience : audiences) {
            if (audience == null) {
                continue;
            }
            String value = audience.trim().toLowerCase(Locale.ROOT);
            if (!Arrays.asList(PASSENGERS, DRIVERS, CORPORATE).contains(value)) {
                throw new BusinessException("Unknown audience: " + audience);
            }
            normalized.add(value);
        }

        if (normalized.isEmpty()) {
            throw new BusinessException("Choose at least one audience.");
        }
        return normalized;
    }

    private String requireText(String value, String errorMessage) {
        String trimmed = value == null ? "" : value.trim();
        if (trimmed.isEmpty()) {
            throw new BusinessException(errorMessage);
        }
        return trimmed;
    }
}
