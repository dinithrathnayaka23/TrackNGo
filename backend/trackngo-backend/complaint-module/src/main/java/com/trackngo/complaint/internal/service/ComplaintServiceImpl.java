package com.trackngo.complaint.internal.service;

import com.trackngo.complaint.api.ComplaintService;
import com.trackngo.complaint.api.dto.ComplaintDto;
import com.trackngo.complaint.events.ComplaintCreatedEvent;
import com.trackngo.complaint.internal.entity.Complaint;
import com.trackngo.complaint.internal.repository.ComplaintRepository;
import com.trackngo.commons.events.EventPublisher;
import com.trackngo.commons.exception.BusinessException;
import com.trackngo.commons.exception.ResourceNotFoundException;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Time;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ComplaintServiceImpl implements ComplaintService {
    private static final Set<String> ALLOWED_COMPLAINT_TYPES = Set.of(
        "late_arrival",
        "driver_behavior",
        "bus_condition",
        "route_issue",
        "payment_issue",
        "booking_issue",
        "safety_concern",
        "other"
    );
    private static final Set<String> ALLOWED_PRIORITIES = Set.of("low", "medium", "high");
    private static final Set<String> ALLOWED_STATUSES = Set.of("pending", "under_review", "resolved", "rejected");

    private final ComplaintRepository repository;
    private final EventPublisher eventPublisher;
    private final JdbcTemplate jdbc;

    @PostConstruct
    void ensureComplaintSchema() {
        ensureColumnExists(
            "booking_reference",
            "ALTER TABLE complaint ADD COLUMN booking_reference VARCHAR(50) NULL AFTER image"
        );
        ensureIndexExists(
            "idx_booking_reference",
            "ALTER TABLE complaint ADD INDEX idx_booking_reference (booking_reference)"
        );
        ensureComplaintTypeAllowsLateArrival();
    }

    @Override
    public ComplaintDto create(String email, ComplaintDto dto) {
        Complaint entity = new Complaint();
        applyCreateFields(entity, dto, email);
        Complaint saved = repository.save(entity);
        eventPublisher.publish(new ComplaintCreatedEvent(saved.getId()));
        return toDto(saved);
    }

    @Override
    public ComplaintDto get(Long id) {
        return toDto(repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Complaint not found")));
    }

    @Override
    public List<ComplaintDto> getAll() {
        return repository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"))
            .stream()
            .map(this::toDto)
            .toList();
    }

    @Override
    public List<ComplaintDto> getMine(String email) {
        return repository.findOwnedByEmail(email)
            .stream()
            .map(this::toDto)
            .toList();
    }

    @Override
    public ComplaintDto update(Long id, ComplaintDto dto) {
        Complaint entity = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Complaint not found"));

        entity.setImage(trimToNull(dto.getImage()));
        entity.setBookingReference(trimToNull(dto.getBookingReference()));
        entity.setComplaintType(normalizeComplaintType(dto.getComplaintType()));
        entity.setPriority(normalizePriority(dto.getPriority()));
        entity.setDescription(requireDescription(dto.getDescription()));
        entity.setStatus(normalizeStatus(dto.getStatus()));
        entity.setAdminResponse(trimToNull(dto.getAdminResponse()));

        if ("resolved".equals(entity.getStatus())) {
            entity.setResolvedAt(dto.getResolvedAt() != null ? dto.getResolvedAt() : LocalDateTime.now());
        } else {
            entity.setResolvedAt(dto.getResolvedAt());
        }

        return toDto(repository.save(entity));
    }

    @Override
    public void delete(Long id) {
        repository.deleteById(id);
    }

    private void applyCreateFields(Complaint entity, ComplaintDto dto, String email) {
        Map<String, Object> owner = resolveOwner(email);
        long userId = ((Number) owner.get("user_id")).longValue();
        String userType = String.valueOf(owner.get("user_type"));
        String bookingReference = trimToNull(dto.getBookingReference());

        entity.setImage(trimToNull(dto.getImage()));
        entity.setBookingReference(null);
        entity.setComplaintType(normalizeComplaintType(dto.getComplaintType()));
        entity.setPriority(normalizePriority(dto.getPriority()));
        entity.setDescription(requireDescription(dto.getDescription()));
        entity.setStatus("pending");
        entity.setAdminResponse(null);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setResolvedAt(null);
        entity.setPassengerId(null);

        switch (userType.toLowerCase(Locale.ROOT)) {
            case "passenger" -> {
                ensureSubtypeExists("passenger", "passenger_id", userId);
                entity.setBookingReference(resolvePastPassengerBookingReference(email, bookingReference));
                entity.setPassengerId(userId);
            }
            case "admin" -> throw new BusinessException("Admins cannot submit complaints");
            default -> throw new BusinessException("Only passengers can submit complaints");
        }
    }

    private Map<String, Object> resolveOwner(String email) {
        try {
            return jdbc.queryForMap(
                "SELECT user_id, user_type FROM `user` WHERE email = ?",
                email
            );
        } catch (EmptyResultDataAccessException ex) {
            throw new BusinessException("Authenticated user not found");
        }
    }

    private void ensureSubtypeExists(String tableName, String columnName, long userId) {
        Boolean exists = jdbc.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM " + tableName + " WHERE " + columnName + " = ?)",
            Boolean.class,
            userId
        );
        if (!Boolean.TRUE.equals(exists)) {
            throw new BusinessException("Complaint owner profile is missing");
        }
    }

    private void ensureColumnExists(String columnName, String alterSql) {
        Boolean exists = jdbc.queryForObject(
            """
            SELECT EXISTS(
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND table_name = 'complaint'
                  AND column_name = ?
            )
            """,
            Boolean.class,
            columnName
        );
        if (!Boolean.TRUE.equals(exists)) {
            jdbc.execute(alterSql);
        }
    }

    private void ensureIndexExists(String indexName, String alterSql) {
        Boolean exists = jdbc.queryForObject(
            """
            SELECT EXISTS(
                SELECT 1
                FROM information_schema.statistics
                WHERE table_schema = DATABASE()
                  AND table_name = 'complaint'
                  AND index_name = ?
            )
            """,
            Boolean.class,
            indexName
        );
        if (!Boolean.TRUE.equals(exists)) {
            jdbc.execute(alterSql);
        }
    }

    private void ensureComplaintTypeAllowsLateArrival() {
        String columnType = jdbc.queryForObject(
            """
            SELECT column_type
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'complaint'
              AND column_name = 'complaint_type'
            """,
            String.class
        );

        if (columnType != null && !columnType.contains("'late_arrival'")) {
            jdbc.execute(
                """
                ALTER TABLE complaint
                MODIFY complaint_type ENUM(
                    'late_arrival',
                    'driver_behavior',
                    'bus_condition',
                    'route_issue',
                    'payment_issue',
                    'booking_issue',
                    'safety_concern',
                    'other'
                ) NOT NULL
                """
            );
        }
    }

    private String resolvePastPassengerBookingReference(String email, String bookingReference) {
        if (bookingReference == null) {
            throw new BusinessException("Booking reference is required for passenger complaints");
        }

        Map<String, Object> booking;
        try {
            booking = jdbc.queryForMap(
                """
                SELECT sb.booking_reference, sb.status, sb.journey_date, sb.journey_time
                FROM seat_booking sb
                INNER JOIN passenger p ON p.passenger_id = sb.passenger_id
                INNER JOIN `user` u ON u.user_id = p.passenger_id
                WHERE u.email = ? AND sb.booking_reference = ?
                """,
                email,
                bookingReference
            );
        } catch (EmptyResultDataAccessException ex) {
            throw new BusinessException("Past booking not found for this passenger");
        }

        String status = normalizeKey(String.valueOf(booking.get("status")));
        if ("cancelled".equals(status)) {
            throw new BusinessException("Cancelled bookings cannot be used to submit complaints");
        }

        LocalDate journeyDate = booking.get("journey_date") instanceof java.sql.Date date
            ? date.toLocalDate()
            : (LocalDate) booking.get("journey_date");
        LocalTime journeyTime = booking.get("journey_time") instanceof Time time
            ? time.toLocalTime()
            : (LocalTime) booking.get("journey_time");
        LocalDateTime journeyDateTime = LocalDateTime.of(journeyDate, journeyTime);

        if (!journeyDateTime.isBefore(LocalDateTime.now())) {
            throw new BusinessException("Complaints can only be submitted for past bookings");
        }

        return bookingReference;
    }

    private String normalizeComplaintType(String rawValue) {
        String normalized = normalizeKey(rawValue);
        if (!ALLOWED_COMPLAINT_TYPES.contains(normalized)) {
            throw new BusinessException("Invalid complaint type");
        }
        return normalized;
    }

    private String normalizePriority(String rawValue) {
        String normalized = normalizeKey(rawValue);
        if (normalized.isBlank()) {
            return "medium";
        }
        if (!ALLOWED_PRIORITIES.contains(normalized)) {
            throw new BusinessException("Invalid complaint priority");
        }
        return normalized;
    }

    private String normalizeStatus(String rawValue) {
        String normalized = normalizeKey(rawValue);
        if (normalized.isBlank()) {
            return "pending";
        }
        if (!ALLOWED_STATUSES.contains(normalized)) {
            throw new BusinessException("Invalid complaint status");
        }
        return normalized;
    }

    private String requireDescription(String value) {
        String trimmed = trimToNull(value);
        if (trimmed == null) {
            throw new BusinessException("Complaint description is required");
        }
        return trimmed;
    }

    private String normalizeKey(String value) {
        if (value == null) {
            return "";
        }
        return value.trim()
            .toLowerCase(Locale.ROOT)
            .replace('-', '_')
            .replace(' ', '_');
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private ComplaintDto toDto(Complaint entity) {
        ComplaintDto dto = new ComplaintDto();
        dto.setId(entity.getId());
        dto.setImage(entity.getImage());
        dto.setBookingReference(entity.getBookingReference());
        dto.setComplaintType(entity.getComplaintType());
        dto.setPriority(entity.getPriority());
        dto.setDescription(entity.getDescription());
        dto.setStatus(entity.getStatus());
        dto.setAdminResponse(entity.getAdminResponse());
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setResolvedAt(entity.getResolvedAt());
        dto.setPassengerId(entity.getPassengerId());
        return dto;
    }
}
