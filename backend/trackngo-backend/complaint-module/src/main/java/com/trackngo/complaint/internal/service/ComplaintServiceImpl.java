package com.trackngo.complaint.internal.service;

import com.trackngo.complaint.api.ComplaintService;
import com.trackngo.complaint.api.dto.ComplaintDto;
import com.trackngo.complaint.events.ComplaintCreatedEvent;
import com.trackngo.complaint.internal.entity.Complaint;
import com.trackngo.complaint.internal.repository.ComplaintRepository;
import com.trackngo.commons.events.EventPublisher;
import com.trackngo.commons.exception.BusinessException;
import com.trackngo.commons.exception.ResourceNotFoundException;
import com.trackngo.notification.api.NotificationDispatcher;
import com.trackngo.notification.api.NotificationType;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Time;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ComplaintServiceImpl implements ComplaintService {
    private static final Set<String> ALLOWED_COMPLAINT_TYPES = Set.of(
        "driver_behavior",
        "bus_condition",
        "route_issue",
        "late_arrival",
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
    private final NotificationDispatcher notifications;

    @Value("${trackngo.time-zone:Asia/Colombo}")
    private String timeZoneId;

    /** Ensures the complaint table contains the driver and booking fields required by this module. */
    @PostConstruct
    void ensureComplaintSchema() {
        ensureColumnExists(
            "driver_id",
            "ALTER TABLE complaint ADD COLUMN driver_id BIGINT NULL AFTER passenger_id"
        );
        ensureColumnExists(
            "booking_reference",
            "ALTER TABLE complaint ADD COLUMN booking_reference VARCHAR(50) NULL AFTER image"
        );
        ensureIndexExists(
            "idx_booking_reference",
            "ALTER TABLE complaint ADD INDEX idx_booking_reference (booking_reference)"
        );
        ensureComplaintDateTimeColumns();
    }

    /** Creates a complaint, validates passenger ownership, and publishes a created event. */
    @Override
    public ComplaintDto create(String email, ComplaintDto dto) {
        Complaint entity = new Complaint();
        applyCreateFields(entity, dto, email);
        Complaint saved = repository.save(entity);
        eventPublisher.publish(new ComplaintCreatedEvent(saved.getId()));

        notifications.toPassenger(
            saved.getPassengerId(),
            NotificationType.COMPLAINT,
            "Complaint Received",
            "Your complaint about " + complaintTypeLabel(saved.getComplaintType())
                + (saved.getBookingReference() == null ? "" : " for booking " + saved.getBookingReference())
                + " has been received. Our support team will review it shortly."
        );

        notifications.toDriver(
            resolveBookingDriverId(saved.getBookingReference()),
            NotificationType.COMPLAINT,
            "Complaint Filed About Your Trip",
            "A passenger raised a complaint about " + complaintTypeLabel(saved.getComplaintType())
                + (saved.getBookingReference() == null ? "" : " for booking " + saved.getBookingReference())
                + ". Our support team is reviewing it."
        );

        notifications.toAllAdmins(
            NotificationType.COMPLAINT,
            "New Complaint Submitted",
            "A " + saved.getPriority() + "-priority complaint about "
                + complaintTypeLabel(saved.getComplaintType())
                + (saved.getBookingReference() == null ? "" : " for booking " + saved.getBookingReference())
                + " is waiting for review."
        );

        return toDto(saved);
    }

    /** Returns one complaint as a DTO. */
    @Override
    public ComplaintDto get(Long id) {
        return toDto(repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Complaint not found")));
    }

    /** Returns all complaints ordered from newest to oldest. */
    @Override
    public List<ComplaintDto> getAll() {
        return repository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"))
            .stream()
            .map(this::toDto)
            .toList();
    }

    /** Returns the complaints owned by the given passenger email. */
    @Override
    public List<ComplaintDto> getMine(String email) {
        return repository.findOwnedByEmail(email)
            .stream()
            .map(this::toDto)
            .toList();
    }

    /** Returns the complaints filed against the given driver, newest first. */
    @Override
    public List<ComplaintDto> getForDriver(Long driverId) {
        return repository.findByDriverId(driverId)
            .stream()
            .map(this::toDto)
            .toList();
    }

    /** Updates complaint fields and keeps the resolved timestamp consistent with the status. */
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
            entity.setResolvedAt(dto.getResolvedAt() != null ? dto.getResolvedAt() : currentDateTime());
        } else {
            entity.setResolvedAt(dto.getResolvedAt());
        }

        Complaint saved = repository.save(entity);
        return toDto(saved);
    }

    /** Deletes a complaint by its identifier. */
    @Override
    public void delete(Long id) {
        repository.deleteById(id);
    }

    /** Populates a new complaint entity while enforcing passenger-only submission rules. */
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
        entity.setCreatedAt(currentDateTime());
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

    /** Loads the base user record for the authenticated complaint owner. */
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

    /** Verifies that the specialized profile row exists for the complaint owner. */
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

    /** Adds a missing complaint column during startup. */
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

    /** Adds a missing complaint index during startup. */
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

    /**
     * Migrates complaint timestamps away from TIMESTAMP so the database stores the Sri Lanka
     * wall-clock time directly instead of a UTC-shifted representation.
     */
    private void ensureComplaintDateTimeColumns() {
        String createdAtType = findColumnType("created_at");
        String resolvedAtType = findColumnType("resolved_at");
        boolean createdAtNeedsMigration = "timestamp".equalsIgnoreCase(createdAtType);
        boolean resolvedAtNeedsMigration = "timestamp".equalsIgnoreCase(resolvedAtType);

        if (!createdAtNeedsMigration && !resolvedAtNeedsMigration) {
            return;
        }

        if (createdAtNeedsMigration) {
            jdbc.execute("UPDATE complaint SET created_at = DATE_ADD(created_at, INTERVAL 330 MINUTE) WHERE created_at IS NOT NULL");
            jdbc.execute("ALTER TABLE complaint MODIFY COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
        }

        if (resolvedAtNeedsMigration) {
            jdbc.execute("UPDATE complaint SET resolved_at = DATE_ADD(resolved_at, INTERVAL 330 MINUTE) WHERE resolved_at IS NOT NULL");
            jdbc.execute("ALTER TABLE complaint MODIFY COLUMN resolved_at DATETIME NULL");
        }
    }

    /** Returns the current database column type for the complaint table. */
    private String findColumnType(String columnName) {
        return jdbc.queryForObject(
            """
            SELECT DATA_TYPE
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'complaint'
              AND column_name = ?
            """,
            String.class,
            columnName
        );
    }

    /**
     * Confirms the booking belongs to the passenger and happened in the past.
     *
     * Booking history is a union of two sources: seat bookings, which carry a real
     * booking_reference, and trip bookings, whose reference is synthesised as
     * 'BK-' + trip_booking_id and has no row in seat_booking at all. Looking only in
     * seat_booking rejected every trip booking as "not found".
     *
     * The prefix cannot be used to tell the two apart, because seat references are
     * themselves formatted 'BK-{yyyyMMdd}-{suffix}'. The reference is therefore matched
     * against seat_booking first, where it is an exact stored string, and only a miss
     * is reinterpreted as a trip booking id. That ordering stays correct even if a seat
     * reference is ever generated in a shape that parses as a number.
     */
    private String resolvePastPassengerBookingReference(String email, String bookingReference) {
        if (bookingReference == null) {
            throw new BusinessException("Booking reference is required for passenger complaints");
        }

        Map<String, Object> seatBooking = findSeatBooking(email, bookingReference);
        if (seatBooking != null) {
            return resolvePastSeatBooking(seatBooking, bookingReference);
        }

        if (bookingReference.startsWith("BK-")) {
            try {
                long tripBookingId = Long.parseLong(bookingReference.substring(3));
                return resolvePastTripBooking(email, tripBookingId, bookingReference);
            } catch (NumberFormatException ignored) {
                // Falls through: not every "BK-" prefixed value is a trip booking id.
            }
        }
        throw new BusinessException("Past booking not found for this passenger");
    }

    /** Loads a seat booking owned by the passenger, or null when the reference is not one. */
    private Map<String, Object> findSeatBooking(String email, String bookingReference) {
        try {
            return jdbc.queryForMap(
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
            return null;
        }
    }

    /** Validates an already-loaded seat booking row. */
    private String resolvePastSeatBooking(Map<String, Object> booking, String bookingReference) {
        LocalDate journeyDate = toLocalDate(booking.get("journey_date"));
        LocalTime journeyTime = booking.get("journey_time") instanceof Time time
            ? time.toLocalTime()
            : (LocalTime) booking.get("journey_time");

        requirePastNonCancelled(
            String.valueOf(booking.get("status")),
            LocalDateTime.of(journeyDate, journeyTime)
        );
        return bookingReference;
    }

    /** Validates a trip booking reference of the form 'BK-{tripBookingId}'. */
    private String resolvePastTripBooking(String email, long tripBookingId, String bookingReference) {
        Map<String, Object> booking;
        try {
            booking = jdbc.queryForMap(
                """
                SELECT tb.booking_status AS status, tb.start_date AS journey_date
                FROM trip_booking tb
                INNER JOIN `user` u ON u.user_id = tb.passenger_id
                WHERE u.email = ? AND tb.trip_booking_id = ?
                """,
                email,
                tripBookingId
            );
        } catch (EmptyResultDataAccessException ex) {
            throw new BusinessException("Past booking not found for this passenger");
        }

        // Trip bookings record only a start date, so treat the whole day as elapsed.
        LocalDate journeyDate = toLocalDate(booking.get("journey_date"));
        requirePastNonCancelled(
            String.valueOf(booking.get("status")),
            journeyDate.plusDays(1).atStartOfDay()
        );
        return bookingReference;
    }

    /** Rejects cancelled bookings and journeys that have not happened yet. */
    private void requirePastNonCancelled(String status, LocalDateTime journeyEnd) {
        if ("cancelled".equals(normalizeKey(status))) {
            throw new BusinessException("Cancelled bookings cannot be used to submit complaints");
        }
        if (!journeyEnd.isBefore(currentDateTime())) {
            throw new BusinessException("Complaints can only be submitted for past bookings");
        }
    }

    /** Reads a date column that JDBC may hand back as java.sql.Date or LocalDate. */
    private LocalDate toLocalDate(Object value) {
        if (value instanceof java.sql.Date date) {
            return date.toLocalDate();
        }
        if (value instanceof LocalDateTime dateTime) {
            return dateTime.toLocalDate();
        }
        return (LocalDate) value;
    }

    /**
     * Finds the driver who ran the trip a complaint is about.
     *
     * The complaint's own driver_id is not always populated, so the booking is
     * the reliable route to the driver - the same resolution the admin
     * dashboard and the driver complaint list already use.
     */
    private Long resolveBookingDriverId(String bookingReference) {
        if (bookingReference == null) {
            return null;
        }

        Long seatDriverId = firstDriverId(jdbc.queryForList(
            """
            SELECT b.driver_id
            FROM seat_booking sb
            INNER JOIN bus b ON b.bus_id = sb.bus_id
            WHERE sb.booking_reference = ?
            """,
            bookingReference
        ));
        if (seatDriverId != null) {
            return seatDriverId;
        }

        // Trip bookings are not in seat_booking and name their driver directly, so they
        // need their own lookup or the driver is never told about the complaint. Seat
        // bookings are checked first for the same reason as in the reference validation:
        // both kinds of reference start with 'BK-'.
        if (bookingReference.startsWith("BK-")) {
            try {
                long tripBookingId = Long.parseLong(bookingReference.substring(3));
                return firstDriverId(jdbc.queryForList(
                    "SELECT tb.driver_id FROM trip_booking tb WHERE tb.trip_booking_id = ?",
                    tripBookingId
                ));
            } catch (NumberFormatException ignored) {
                // Falls through: not every "BK-" prefixed value is a trip booking id.
            }
        }
        return null;
    }

    /** Reads the driver id out of the first row, tolerating an empty result. */
    private Long firstDriverId(List<Map<String, Object>> rows) {
        if (rows == null || rows.isEmpty()) {
            return null;
        }
        return rows.get(0).get("driver_id") instanceof Number number ? number.longValue() : null;
    }

    /** Describes a complaint type in the wording used inside notification messages. */
    private String complaintTypeLabel(String complaintType) {
        return switch (normalizeKey(complaintType)) {
            case "driver_behavior" -> "driver behaviour";
            case "bus_condition" -> "bus condition";
            case "route_issue" -> "a route issue";
            case "late_arrival" -> "a late arrival";
            case "payment_issue" -> "a payment issue";
            case "booking_issue" -> "a booking issue";
            case "safety_concern" -> "a safety concern";
            default -> "your journey";
        };
    }

    /** Normalizes and validates the complaint type. */
    private String normalizeComplaintType(String rawValue) {
        String normalized = normalizeKey(rawValue);
        if (!ALLOWED_COMPLAINT_TYPES.contains(normalized)) {
            throw new BusinessException("Invalid complaint type");
        }
        return normalized;
    }

    /** Normalizes the complaint priority and applies the default when omitted. */
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

    /** Normalizes the complaint status and applies the default when omitted. */
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

    /** Ensures the complaint description contains a non-blank value. */
    private String requireDescription(String value) {
        String trimmed = trimToNull(value);
        if (trimmed == null) {
            throw new BusinessException("Complaint description is required");
        }
        return trimmed;
    }

    /** Converts user input into the normalized key format used by validations. */
    private String normalizeKey(String value) {
        if (value == null) {
            return "";
        }
        return value.trim()
            .toLowerCase(Locale.ROOT)
            .replace('-', '_')
            .replace(' ', '_');
    }

    /** Trims text input and converts blank values to null. */
    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    /** Returns the current application time in the configured business timezone. */
    private LocalDateTime currentDateTime() {
        return LocalDateTime.now(resolveZoneId());
    }

    /** Falls back to the TrackNGo business timezone when Spring config is not injected in plain unit tests. */
    private ZoneId resolveZoneId() {
        String configured = timeZoneId == null || timeZoneId.isBlank() ? "Asia/Colombo" : timeZoneId;
        return ZoneId.of(configured);
    }

    /** Maps a complaint entity into the API DTO returned by the module. */
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
        dto.setDriverId(entity.getDriverId());
        return dto;
    }
}
