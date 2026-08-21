package com.trackngo.feedbackrating.internal.service;

import com.trackngo.commons.events.EventPublisher;
import com.trackngo.commons.exception.BusinessException;
import com.trackngo.feedbackrating.api.RatingService;
import com.trackngo.feedbackrating.api.dto.RatingContextDto;
import com.trackngo.feedbackrating.api.dto.RatingDto;
import com.trackngo.feedbackrating.events.RatingCreatedEvent;
import com.trackngo.feedbackrating.internal.entity.Rating;
import com.trackngo.feedbackrating.internal.repository.RatingRepository;
import com.trackngo.notification.api.NotificationDispatcher;
import com.trackngo.notification.api.NotificationType;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class RatingServiceImpl implements RatingService {
    private final RatingRepository repository;
    private final EventPublisher eventPublisher;
    private final JdbcTemplate jdbc;
    private final NotificationDispatcher notifications;

    @Value("${trackngo.time-zone:Asia/Colombo}")
    private String timeZoneId;

    /** Creates the ratings table on startup so no manual migration is needed before deploying. */
    @PostConstruct
    void ensureRatingsSchema() {
        if (tableExists("ratings") && !columnExists("ratings", "rating_id")) {
            // Hibernate's ddl-auto=update previously auto-generated this table from an early
            // placeholder entity (id/name columns only). No real ratings can exist yet since
            // this feature just shipped, so it's safe to replace with the real shape below.
            jdbc.execute("DROP TABLE ratings");
        }
        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS ratings (
                rating_id BIGINT PRIMARY KEY AUTO_INCREMENT,
                booking_reference VARCHAR(50) NOT NULL,
                passenger_id BIGINT NOT NULL,
                driver_id BIGINT NULL,
                bus_id BIGINT NULL,
                route_id BIGINT NULL,
                driver_rating TINYINT NULL,
                bus_rating TINYINT NULL,
                journey_rating TINYINT NULL,
                comment TEXT NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NULL,
                UNIQUE KEY uk_ratings_booking_reference (booking_reference),
                INDEX idx_ratings_driver (driver_id),
                INDEX idx_ratings_bus (bus_id)
            )
            """);
    }

    private boolean tableExists(String tableName) {
        Boolean exists = jdbc.queryForObject(
            """
            SELECT EXISTS(
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = DATABASE() AND table_name = ?
            )
            """,
            Boolean.class,
            tableName
        );
        return Boolean.TRUE.equals(exists);
    }

    private boolean columnExists(String tableName, String columnName) {
        Boolean exists = jdbc.queryForObject(
            """
            SELECT EXISTS(
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
            )
            """,
            Boolean.class,
            tableName,
            columnName
        );
        return Boolean.TRUE.equals(exists);
    }

    @Override
    public RatingContextDto getContext(String email, String bookingReference) {
        long passengerId = resolvePassengerId(email);
        BookingContext ctx = resolveBookingContext(email, bookingReference);

        RatingContextDto dto = new RatingContextDto();
        dto.setBookingReference(ctx.bookingReference());
        dto.setStartLocation(ctx.startLocation());
        dto.setEndLocation(ctx.endLocation());
        dto.setJourneyDate(ctx.journeyDate());
        dto.setBusNumber(ctx.busNumber());
        dto.setBusType(ctx.busType());
        dto.setDriverId(ctx.driverId());
        dto.setDriverName(ctx.driverName());
        dto.setBusId(ctx.busId());

        repository.findByBookingReferenceAndPassengerId(ctx.bookingReference(), passengerId)
            .ifPresent(existing -> {
                dto.setAlreadyRated(true);
                dto.setDriverRating(existing.getDriverRating());
                dto.setBusRating(existing.getBusRating());
                dto.setJourneyRating(existing.getJourneyRating());
                dto.setComment(existing.getComment());
            });
        return dto;
    }

    @Override
    public RatingDto submit(String email, RatingDto dto) {
        long passengerId = resolvePassengerId(email);
        BookingContext ctx = resolveBookingContext(email, trimToNull(dto.getBookingReference()));

        if (ctx.driverId() != null) {
            requireRatingValue(dto.getDriverRating(), "Driver rating");
        }
        if (ctx.busId() != null) {
            requireRatingValue(dto.getBusRating(), "Bus rating");
        }
        requireRatingValue(dto.getJourneyRating(), "Journey rating");

        Rating entity = repository
            .findByBookingReferenceAndPassengerId(ctx.bookingReference(), passengerId)
            .orElseGet(Rating::new);
        boolean isNew = entity.getId() == null;

        entity.setBookingReference(ctx.bookingReference());
        entity.setPassengerId(passengerId);
        entity.setDriverId(ctx.driverId());
        entity.setBusId(ctx.busId());
        entity.setRouteId(ctx.routeId());
        entity.setDriverRating(ctx.driverId() != null ? dto.getDriverRating() : null);
        entity.setBusRating(ctx.busId() != null ? dto.getBusRating() : null);
        entity.setJourneyRating(dto.getJourneyRating());
        entity.setComment(trimToNull(dto.getComment()));
        entity.setUpdatedAt(currentDateTime());
        if (isNew) {
            entity.setCreatedAt(currentDateTime());
        }

        Rating saved = repository.save(entity);
        if (isNew) {
            eventPublisher.publish(new RatingCreatedEvent(saved.getId()));
        }
        if (saved.getDriverId() != null) {
            recomputeDriverAverageRating(saved.getDriverId());
        }

        notifications.toPassenger(
            saved.getPassengerId(),
            NotificationType.RATING,
            isNew ? "Thanks for Your Feedback" : "Rating Updated",
            (isNew ? "Your rating for booking " : "Your updated rating for booking ")
                + saved.getBookingReference() + " has been recorded. Thank you for helping us improve."
        );

        return toDto(saved);
    }

    /** Recomputes and persists the driver's average rating from every rating they've received. */
    private void recomputeDriverAverageRating(Long driverId) {
        jdbc.update("""
            UPDATE driver
            SET average_rating = (
                SELECT AVG(driver_rating) FROM ratings
                WHERE driver_id = ? AND driver_rating IS NOT NULL
            )
            WHERE driver_id = ?
            """, driverId, driverId);
    }

    /** Loads the passenger id for the authenticated user, rejecting non-passenger accounts. */
    private long resolvePassengerId(String email) {
        Map<String, Object> owner;
        try {
            owner = jdbc.queryForMap(
                "SELECT user_id, user_type FROM `user` WHERE email = ?",
                email
            );
        } catch (EmptyResultDataAccessException ex) {
            throw new BusinessException("Authenticated user not found");
        }
        if (!"passenger".equalsIgnoreCase(String.valueOf(owner.get("user_type")))) {
            throw new BusinessException("Only passengers can submit ratings");
        }
        long userId = ((Number) owner.get("user_id")).longValue();
        Boolean exists = jdbc.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM passenger WHERE passenger_id = ?)",
            Boolean.class,
            userId
        );
        if (!Boolean.TRUE.equals(exists)) {
            throw new BusinessException("Passenger profile is missing");
        }
        return userId;
    }

    /** Resolves and validates the past booking a rating is being requested/submitted for. */
    private BookingContext resolveBookingContext(String email, String bookingReference) {
        if (bookingReference == null || bookingReference.isBlank()) {
            throw new BusinessException("Booking reference is required");
        }

        if (bookingReference.startsWith("BK-")) {
            try {
                long tripBookingId = Long.parseLong(bookingReference.substring(3));
                return resolveTripBookingContext(email, tripBookingId, bookingReference);
            } catch (NumberFormatException ignored) {
                // Falls through: not every "BK-" prefixed value is a trip booking id.
            }
        }
        return resolveSeatBookingContext(email, bookingReference);
    }

    private BookingContext resolveSeatBookingContext(String email, String bookingReference) {
        Map<String, Object> row;
        try {
            row = jdbc.queryForMap(
                """
                SELECT sb.status, sb.journey_date,
                       COALESCE(sb.from_stop, r.start_location) AS start_location,
                       COALESCE(sb.to_stop, r.end_location) AS end_location,
                       sb.bus_id, sb.route_id, b.bus_number, b.bus_type, b.driver_id,
                       CONCAT(du.first_name, ' ', du.last_name) AS driver_name
                FROM seat_booking sb
                INNER JOIN passenger p ON p.passenger_id = sb.passenger_id
                INNER JOIN `user` u ON u.user_id = p.passenger_id
                INNER JOIN bus b ON b.bus_id = sb.bus_id
                INNER JOIN route r ON r.route_id = sb.route_id
                LEFT JOIN `user` du ON du.user_id = b.driver_id
                WHERE u.email = ? AND sb.booking_reference = ?
                """,
                email,
                bookingReference
            );
        } catch (EmptyResultDataAccessException ex) {
            throw new BusinessException("Past booking not found for this passenger");
        }

        LocalDate journeyDate = toLocalDate(row.get("journey_date"));
        requirePastNonCancelled(String.valueOf(row.get("status")), journeyDate);

        return new BookingContext(
            bookingReference,
            String.valueOf(row.get("start_location")),
            String.valueOf(row.get("end_location")),
            journeyDate,
            row.get("bus_number") != null ? String.valueOf(row.get("bus_number")) : null,
            row.get("bus_type") != null ? String.valueOf(row.get("bus_type")) : null,
            row.get("bus_id") != null ? ((Number) row.get("bus_id")).longValue() : null,
            row.get("route_id") != null ? ((Number) row.get("route_id")).longValue() : null,
            row.get("driver_id") != null ? ((Number) row.get("driver_id")).longValue() : null,
            cleanDriverName(row.get("driver_id"), row.get("driver_name"))
        );
    }

    private BookingContext resolveTripBookingContext(String email, long tripBookingId, String bookingReference) {
        Map<String, Object> row;
        try {
            row = jdbc.queryForMap(
                """
                SELECT tb.booking_status AS status, tb.start_date AS journey_date,
                       tb.start_location, tb.destination,
                       tb.bus_id, tb.driver_id, b.bus_number, b.bus_type,
                       CONCAT(du.first_name, ' ', du.last_name) AS driver_name
                FROM trip_booking tb
                INNER JOIN `user` u ON u.user_id = tb.passenger_id
                LEFT JOIN bus b ON b.bus_id = tb.bus_id
                LEFT JOIN `user` du ON du.user_id = tb.driver_id
                WHERE u.email = ? AND tb.trip_booking_id = ?
                """,
                email,
                tripBookingId
            );
        } catch (EmptyResultDataAccessException ex) {
            throw new BusinessException("Past booking not found for this passenger");
        }

        LocalDate journeyDate = toLocalDate(row.get("journey_date"));
        requirePastNonCancelled(String.valueOf(row.get("status")), journeyDate);

        return new BookingContext(
            bookingReference,
            String.valueOf(row.get("start_location")),
            String.valueOf(row.get("destination")),
            journeyDate,
            row.get("bus_number") != null ? String.valueOf(row.get("bus_number")) : null,
            row.get("bus_type") != null ? String.valueOf(row.get("bus_type")) : null,
            row.get("bus_id") != null ? ((Number) row.get("bus_id")).longValue() : null,
            null,
            row.get("driver_id") != null ? ((Number) row.get("driver_id")).longValue() : null,
            cleanDriverName(row.get("driver_id"), row.get("driver_name"))
        );
    }

    /** Mirrors the "past" bucket the booking history screen uses: before today, or cancelled. */
    private void requirePastNonCancelled(String status, LocalDate journeyDate) {
        String normalized = normalizeKey(status);
        if ("cancelled".equals(normalized)) {
            throw new BusinessException("Cancelled bookings cannot be rated");
        }
        if (journeyDate == null || !journeyDate.isBefore(currentDateTime().toLocalDate())) {
            throw new BusinessException("Ratings can only be submitted after the journey date");
        }
    }

    private String cleanDriverName(Object driverId, Object driverName) {
        if (driverId == null || driverName == null) {
            return null;
        }
        String name = String.valueOf(driverName).trim();
        return name.isBlank() ? null : name;
    }

    private void requireRatingValue(Integer value, String label) {
        if (value == null || value < 1 || value > 5) {
            throw new BusinessException(label + " must be between 1 and 5");
        }
    }

    private LocalDate toLocalDate(Object value) {
        if (value instanceof java.sql.Date date) {
            return date.toLocalDate();
        }
        return (LocalDate) value;
    }

    private String normalizeKey(String value) {
        if (value == null) {
            return "";
        }
        return value.trim().toLowerCase(Locale.ROOT).replace('-', '_').replace(' ', '_');
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private LocalDateTime currentDateTime() {
        return LocalDateTime.now(resolveZoneId());
    }

    private ZoneId resolveZoneId() {
        String configured = timeZoneId == null || timeZoneId.isBlank() ? "Asia/Colombo" : timeZoneId;
        return ZoneId.of(configured);
    }

    private RatingDto toDto(Rating entity) {
        RatingDto dto = new RatingDto();
        dto.setId(entity.getId());
        dto.setBookingReference(entity.getBookingReference());
        dto.setPassengerId(entity.getPassengerId());
        dto.setDriverId(entity.getDriverId());
        dto.setBusId(entity.getBusId());
        dto.setRouteId(entity.getRouteId());
        dto.setDriverRating(entity.getDriverRating());
        dto.setBusRating(entity.getBusRating());
        dto.setJourneyRating(entity.getJourneyRating());
        dto.setComment(entity.getComment());
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setUpdatedAt(entity.getUpdatedAt());
        return dto;
    }

    private record BookingContext(
        String bookingReference,
        String startLocation,
        String endLocation,
        LocalDate journeyDate,
        String busNumber,
        String busType,
        Long busId,
        Long routeId,
        Long driverId,
        String driverName
    ) {
    }
}
