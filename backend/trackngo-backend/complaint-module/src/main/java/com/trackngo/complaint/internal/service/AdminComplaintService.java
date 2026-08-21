package com.trackngo.complaint.internal.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.trackngo.complaint.api.dto.AdminComplaintDtos.AdminComplaintDetail;
import com.trackngo.complaint.api.dto.AdminComplaintDtos.AdminComplaintListItem;
import com.trackngo.complaint.api.dto.AdminComplaintDtos.AdminComplaintUpdateRequest;
import com.trackngo.complaint.internal.entity.Complaint;
import com.trackngo.complaint.internal.repository.ComplaintRepository;
import com.trackngo.commons.exception.BusinessException;
import com.trackngo.commons.exception.ResourceNotFoundException;
import com.trackngo.notification.api.NotificationDispatcher;
import com.trackngo.notification.api.NotificationType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class AdminComplaintService {
    private static final DateTimeFormatter CREATED_FORMAT =
        DateTimeFormatter.ofPattern("MMM dd, hh:mm a", Locale.ENGLISH);
    private static final DateTimeFormatter SORT_FORMAT =
        DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final JdbcTemplate jdbc;
    private final ComplaintRepository repository;
    private final ObjectMapper objectMapper;
    private final NotificationDispatcher notifications;

    @Value("${trackngo.time-zone:Asia/Colombo}")
    private String timeZoneId;

    /** Creates the admin complaint service with its data, JSON and notification helpers. */
    public AdminComplaintService(
        JdbcTemplate jdbc,
        ComplaintRepository repository,
        ObjectMapper objectMapper,
        NotificationDispatcher notifications
    ) {
        this.jdbc = jdbc;
        this.repository = repository;
        this.objectMapper = objectMapper;
        this.notifications = notifications;
    }

    /** Loads complaint rows for the admin dashboard list. */
    public List<AdminComplaintListItem> listComplaints() {
        String sql = """
            SELECT
                c.complaint_id,
                c.priority,
                c.complaint_type,
                c.description,
                c.image,
                c.status,
                c.created_at,
                c.booking_reference,
                sb.bus_id AS seat_bus_id,
                b.bus_number,
                reporter.first_name AS reporter_first_name,
                reporter.last_name AS reporter_last_name,
                driver_user.first_name AS driver_first_name,
                driver_user.last_name AS driver_last_name
            FROM complaint c
            LEFT JOIN seat_booking sb ON sb.booking_reference = c.booking_reference
            LEFT JOIN bus b ON b.bus_id = sb.bus_id
            LEFT JOIN `user` reporter ON reporter.user_id = c.passenger_id
            LEFT JOIN driver d ON d.driver_id = b.driver_id
            LEFT JOIN `user` driver_user ON driver_user.user_id = d.driver_id
            ORDER BY c.created_at DESC, c.complaint_id DESC
            """;

        return jdbc.queryForList(sql).stream()
            .map(this::toAdminListItem)
            .toList();
    }

    /** Updates the complaint review status and stores the optional admin response. */
    public void updateComplaint(Long complaintId, AdminComplaintUpdateRequest request) {
        Complaint complaint = repository.findById(complaintId)
            .orElseThrow(() -> new ResourceNotFoundException("Complaint not found"));

        String normalizedStatus = normalizeStatus(request.status());
        complaint.setStatus(normalizedStatus);
        complaint.setAdminResponse(trimToNull(request.adminResponse()));
        complaint.setResolvedAt("resolved".equals(normalizedStatus) ? currentDateTime() : null);
        repository.save(complaint);

        notifyComplaintStatusChange(complaint);
    }

    /**
     * Tells the passenger their complaint moved on.
     *
     * A move back to "pending" is deliberately silent: the passenger was already
     * told the complaint was received when they filed it, so repeating that adds
     * nothing to their feed.
     */
    private void notifyComplaintStatusChange(Complaint complaint) {
        String status = normalizeKey(complaint.getStatus());
        if ("pending".equals(status)) {
            return;
        }

        String title = switch (status) {
            case "under_review" -> "Complaint Under Review";
            case "resolved" -> "Complaint Resolved";
            case "rejected" -> "Complaint Closed";
            default -> "Complaint Updated";
        };
        String message = switch (status) {
            case "under_review" -> "Your complaint is now being reviewed by our support team.";
            case "resolved" -> "Your complaint has been resolved.";
            case "rejected" -> "Your complaint was reviewed and closed without further action.";
            default -> "Your complaint status changed to " + toStatusLabel(complaint.getStatus()) + ".";
        };

        String adminResponse = trimToNull(complaint.getAdminResponse());
        if (adminResponse != null) {
            message = message + " Support team: " + adminResponse;
        }

        notifications.toPassenger(
            complaint.getPassengerId(),
            NotificationType.COMPLAINT,
            title,
            message
        );

        // Drivers are told the outcome only. "Under review" is an internal step
        // that does not need their attention, and they already heard when the
        // complaint was filed.
        if ("resolved".equals(status) || "rejected".equals(status)) {
            notifications.toDriver(
                resolveComplaintDriverId(complaint),
                NotificationType.COMPLAINT,
                "resolved".equals(status) ? "Complaint Resolved" : "Complaint Closed",
                "resolved".equals(status)
                    ? "A complaint about one of your trips has been resolved by the support team."
                    : "A complaint about one of your trips was reviewed and closed with no action."
            );
        }
    }

    /** Resolves the driver a complaint is about, falling back to the booking. */
    private Long resolveComplaintDriverId(Complaint complaint) {
        if (complaint.getDriverId() != null) {
            return complaint.getDriverId();
        }
        if (complaint.getBookingReference() == null) {
            return null;
        }

        List<Map<String, Object>> rows = jdbc.queryForList(
            """
            SELECT b.driver_id
            FROM seat_booking sb
            INNER JOIN bus b ON b.bus_id = sb.bus_id
            WHERE sb.booking_reference = ?
            """,
            complaint.getBookingReference()
        );
        if (rows == null || rows.isEmpty()) {
            return null;
        }
        return rows.get(0).get("driver_id") instanceof Number number ? number.longValue() : null;
    }

    /** Loads the detailed admin view for a single complaint. */
    public AdminComplaintDetail getComplaintDetail(Long complaintId) {
        String sql = """
            SELECT
                c.complaint_id,
                c.priority,
                c.complaint_type,
                c.description,
                c.image,
                c.status,
                c.created_at,
                c.admin_response,
                c.booking_reference,
                b.bus_number,
                reporter.first_name AS reporter_first_name,
                reporter.last_name AS reporter_last_name,
                p.mobile_number AS passenger_phone_number,
                driver_user.first_name AS driver_first_name,
                driver_user.last_name AS driver_last_name,
                d.phone_number AS driver_phone_number
            FROM complaint c
            LEFT JOIN seat_booking sb ON sb.booking_reference = c.booking_reference
            LEFT JOIN bus b ON b.bus_id = sb.bus_id
            LEFT JOIN passenger p ON p.passenger_id = c.passenger_id
            LEFT JOIN `user` reporter ON reporter.user_id = c.passenger_id
            LEFT JOIN driver d ON d.driver_id = b.driver_id
            LEFT JOIN `user` driver_user ON driver_user.user_id = d.driver_id
            WHERE c.complaint_id = ?
            """;

        List<Map<String, Object>> rows = jdbc.queryForList(sql, complaintId);
        if (rows.isEmpty()) {
            throw new ResourceNotFoundException("Complaint not found");
        }

        return toAdminDetail(rows.get(0));
    }

    /** Converts a dashboard row into the list item shown in the admin UI. */
    private AdminComplaintListItem toAdminListItem(Map<String, Object> row) {
        long complaintId = ((Number) row.get("complaint_id")).longValue();
        LocalDateTime createdAt = toLocalDateTime(row.get("created_at"));
        String reporterFirstName = trimToEmpty((String) row.get("reporter_first_name"));
        String reporterLastName = trimToEmpty((String) row.get("reporter_last_name"));
        String passengerName = buildFullName(reporterFirstName, reporterLastName);
        String passengerInitials = buildInitials(reporterFirstName, reporterLastName);
        String driverName = buildFullName(
            trimToEmpty((String) row.get("driver_first_name")),
            trimToEmpty((String) row.get("driver_last_name"))
        );
        boolean hasImages = trimToNull((String) row.get("image")) != null;

        return new AdminComplaintListItem(
            formatComplaintCode(complaintId),
            toTitleCase((String) row.get("priority")),
            toComplaintTypeLabel((String) row.get("complaint_type")),
            passengerName.isBlank() ? "Unknown Passenger" : passengerName,
            passengerInitials.isBlank() ? "--" : passengerInitials,
            trimToEmpty((String) row.get("description")),
            trimToNull((String) row.get("booking_reference")) != null
                ? (String) row.get("booking_reference")
                : "--",
            trimToNull((String) row.get("bus_number")) != null
                ? (String) row.get("bus_number")
                : "--",
            driverName,
            hasImages,
            hasImages ? "gallery" : "none",
            toStatusLabel((String) row.get("status")),
            createdAt != null ? createdAt.format(CREATED_FORMAT) : "--",
            createdAt != null ? createdAt.toString() : null,
            createdAt != null ? Long.parseLong(createdAt.format(SORT_FORMAT)) : 0L
        );
    }

    /** Converts a query row into the admin complaint detail payload. */
    private AdminComplaintDetail toAdminDetail(Map<String, Object> row) {
        long complaintId = ((Number) row.get("complaint_id")).longValue();
        LocalDateTime createdAt = toLocalDateTime(row.get("created_at"));
        String reporterFirstName = trimToEmpty((String) row.get("reporter_first_name"));
        String reporterLastName = trimToEmpty((String) row.get("reporter_last_name"));
        String passengerName = buildFullName(reporterFirstName, reporterLastName);
        String driverName = buildFullName(
            trimToEmpty((String) row.get("driver_first_name")),
            trimToEmpty((String) row.get("driver_last_name"))
        );

        return new AdminComplaintDetail(
            formatComplaintCode(complaintId),
            toTitleCase((String) row.get("priority")),
            toComplaintTypeLabel((String) row.get("complaint_type")),
            toStatusLabel((String) row.get("status")),
            createdAt != null ? createdAt.format(CREATED_FORMAT) : "--",
            createdAt != null ? createdAt.toString() : null,
            trimToEmpty((String) row.get("description")),
            trimToNull((String) row.get("booking_reference")) != null
                ? (String) row.get("booking_reference")
                : "--",
            trimToNull((String) row.get("bus_number")) != null
                ? (String) row.get("bus_number")
                : "--",
            passengerName.isBlank() ? "Unknown Passenger" : passengerName,
            defaultLabel((String) row.get("passenger_phone_number")),
            driverName.isBlank() ? "--" : driverName,
            defaultLabel((String) row.get("driver_phone_number")),
            defaultLabel((String) row.get("admin_response")),
            parseImages((String) row.get("image"))
        );
    }

    /** Builds the public complaint code displayed in the admin UI. */
    private String formatComplaintCode(long complaintId) {
        return String.format("#CP-%04d", complaintId);
    }

    /** Converts the stored complaint type key into a readable label. */
    private String toComplaintTypeLabel(String complaintType) {
        return switch (normalizeKey(complaintType)) {
            case "late_arrival" -> "Late Arrival";
            case "driver_behavior" -> "Driver Behavior";
            case "bus_condition" -> "Bus Condition";
            case "route_issue" -> "Route Issue";
            case "payment_issue" -> "Payment Issue";
            case "booking_issue" -> "Booking Issue";
            case "safety_concern" -> "Safety Concern";
            default -> "Other";
        };
    }

    /** Converts the stored complaint status key into a readable label. */
    private String toStatusLabel(String status) {
        return switch (normalizeKey(status)) {
            case "under_review" -> "Under Review";
            case "resolved" -> "Resolved";
            case "rejected" -> "Rejected";
            default -> "Pending";
        };
    }

    /** Converts a normalized key into a simple title-cased label. */
    private String toTitleCase(String rawValue) {
        String normalized = normalizeKey(rawValue);
        if (normalized.isBlank()) {
            return "";
        }
        return Character.toUpperCase(normalized.charAt(0)) + normalized.substring(1);
    }

    /** Validates and normalizes an admin complaint status value. */
    private String normalizeStatus(String rawValue) {
        String normalized = normalizeKey(rawValue);
        return switch (normalized) {
            case "pending", "under_review", "resolved", "rejected" -> normalized;
            case "under review" -> "under_review";
            default -> throw new BusinessException("Invalid complaint status");
        };
    }

    /** Normalizes user-facing keys so lookups use a predictable format. */
    private String normalizeKey(String value) {
        if (value == null) {
            return "";
        }
        return value.trim().toLowerCase(Locale.ROOT).replace('-', '_');
    }

    /** Builds a full name from the first and last name parts. */
    private String buildFullName(String firstName, String lastName) {
        String fullName = (firstName + " " + lastName).trim();
        return fullName.replaceAll("\\s+", " ");
    }

    /** Builds passenger initials for compact list displays. */
    private String buildInitials(String firstName, String lastName) {
        String first = firstName.isBlank() ? "" : firstName.substring(0, 1).toUpperCase(Locale.ROOT);
        String last = lastName.isBlank() ? "" : lastName.substring(0, 1).toUpperCase(Locale.ROOT);
        return first + last;
    }

    /** Converts supported JDBC timestamp values into a LocalDateTime. */
    private LocalDateTime toLocalDateTime(Object value) {
        if (value instanceof Timestamp timestamp) {
            return timestamp.toLocalDateTime();
        }
        if (value instanceof LocalDateTime dateTime) {
            return dateTime;
        }
        return null;
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

    /** Trims text input and returns an empty string when no value exists. */
    private String trimToEmpty(String value) {
        return value == null ? "" : value.trim();
    }

    /** Trims text input and converts blank values to null. */
    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    /** Returns a display-safe label for optional text fields. */
    private String defaultLabel(String value) {
        String trimmed = trimToNull(value);
        return trimmed != null ? trimmed : "--";
    }

    /** Parses image data from either JSON arrays or single stored URLs. */
    private List<String> parseImages(String rawValue) {
        String trimmed = trimToNull(rawValue);
        if (trimmed == null) {
            return List.of();
        }

        try {
            if (trimmed.startsWith("[")) {
                List<String> urls = objectMapper.readValue(trimmed, new TypeReference<List<String>>() {});
                return urls == null ? List.of() : urls.stream()
                    .map(this::trimToNull)
                    .filter(url -> url != null)
                    .toList();
            }
        } catch (Exception ignored) {
            return Collections.singletonList(trimmed);
        }

        return Collections.singletonList(trimmed);
    }
}
