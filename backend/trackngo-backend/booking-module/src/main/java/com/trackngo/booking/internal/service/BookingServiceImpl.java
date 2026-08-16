package com.trackngo.booking.internal.service;

import com.trackngo.booking.api.BookingService;
import com.trackngo.booking.api.dto.BookingDto;
import com.trackngo.booking.api.dto.BookingHistoryDto;
import com.trackngo.booking.api.dto.RecentBookingDto;
import com.trackngo.booking.api.dto.AdminBookingDto;
import com.trackngo.booking.events.BookingCreatedEvent;
import com.trackngo.booking.internal.entity.Booking;
import com.trackngo.booking.internal.repository.BookingHistoryProjection;
import com.trackngo.booking.internal.repository.BookingRepository;
import com.trackngo.commons.events.EventPublisher;
import com.trackngo.commons.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

/**
 * BookingServiceImpl - Implementation of booking business logic
 * 
 * This service class handles all business operations related to trip bookings,
 * including CRUD operations, user-specific booking retrieval, and event publishing.
 * It acts as the intermediary between the controller layer and the data access layer,
 * implementing the BookingService interface.
 * 
 * Key responsibilities:
 * - Creating and managing booking records
 * - Retrieving bookings for users (upcoming, past, recent)
 * - Publishing events for booking lifecycle
 * - Data transformation between entities and DTOs
 * - Error handling for not found resources
 */
@Service
@RequiredArgsConstructor
public class BookingServiceImpl implements BookingService {
    private final BookingRepository repository;
    private final EventPublisher eventPublisher;
    private final JdbcTemplate jdbcTemplate;

    /**
     * Creates a new booking record
     * 
     * Maps the DTO to an entity, saves it to the database, and publishes
     * a BookingCreatedEvent for other modules to react to.
     * 
     * @param dto The booking data from the client
     * @return The created booking as a DTO
     */
    @Override
    public BookingDto create(BookingDto dto) {
        Booking entity = new Booking();
        entity.setName(dto.getName());
        Booking saved = repository.save(entity);
        eventPublisher.publish(new BookingCreatedEvent(saved.getId()));
        return toDto(saved);
    }

    /**
     * Retrieves a booking by ID
     * 
     * @param id The booking ID
     * @return The booking DTO
     * @throws ResourceNotFoundException if booking doesn't exist
     */
    @Override
    public BookingDto get(Long id) {
        return toDto(repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Booking not found")));
    }

    /**
     * Retrieves all bookings (admin use)
     * 
     * @return List of all booking DTOs
     */
    @Override
    public List<BookingDto> getAll() {
        return repository.findAll().stream().map(this::toDto).toList();
    }

    @Override
    public List<AdminBookingDto> getAllForAdmin() {
        return jdbcTemplate.query("""
                SELECT
                    sb.booking_reference AS booking_id,
                    COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''), u.email, CONCAT('User #', u.user_id)) AS passenger_name,
                    CONCAT(COALESCE(NULLIF(sb.from_stop, ''), r.start_location), ' - ', COALESCE(NULLIF(sb.to_stop, ''), r.end_location)) AS route,
                    b.bus_number AS bus,
                    b.bus_type AS bus_type,
                    sb.journey_date,
                    sb.journey_time,
                    sb.seat_number AS seats,
                    sb.total_amount AS amount,
                    COALESCE(p.payment_status, 'unpaid') AS payment_status,
                    sb.status,
                    CASE WHEN LOWER(b.bus_type) IN ('highway', 'long_distance')
                         THEN 'Highway/Long-distance' ELSE 'All Bookings' END AS category
                FROM seat_booking sb
                JOIN passenger pa ON pa.passenger_id = sb.passenger_id
                JOIN `user` u ON u.user_id = pa.passenger_id
                JOIN route r ON r.route_id = sb.route_id
                LEFT JOIN bus b ON b.bus_id = sb.bus_id
                LEFT JOIN payment p ON p.payment_id = sb.payment_id

                UNION ALL

                SELECT
                    CONCAT('BK-', tb.trip_booking_id) AS booking_id,
                    COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''), u.email, CONCAT('User #', u.user_id)) AS passenger_name,
                    CONCAT(tb.start_location, ' - ', tb.destination) AS route,
                    COALESCE(b.bus_number, 'Pending assignment') AS bus,
                    COALESCE(b.bus_type, 'trip_booking') AS bus_type,
                    tb.start_date AS journey_date,
                    CAST('08:00:00' AS TIME) AS journey_time,
                    CONCAT(COALESCE(tb.passenger_count, 0), ' seats') AS seats,
                    COALESCE(tb.final_price, 0) AS amount,
                    COALESCE(p.payment_status, 'unpaid') AS payment_status,
                    tb.booking_status AS status,
                    'Trip Bookings' AS category
                FROM trip_booking tb
                JOIN passenger pa ON pa.passenger_id = tb.passenger_id
                JOIN `user` u ON u.user_id = pa.passenger_id
                LEFT JOIN bus b ON b.bus_id = tb.bus_id
                INNER JOIN payment p ON p.trip_booking_id = tb.trip_booking_id
                    AND p.payment_status = 'success'

                ORDER BY journey_date DESC, journey_time DESC, booking_id DESC
                """, (rs, rowNum) -> new AdminBookingDto(
                rs.getString("booking_id"),
                rs.getString("passenger_name"),
                rs.getString("route"),
                rs.getString("bus"),
                rs.getString("bus_type"),
                rs.getDate("journey_date") != null ? rs.getDate("journey_date").toLocalDate() : null,
                rs.getTime("journey_time") != null ? rs.getTime("journey_time").toLocalTime() : null,
                rs.getString("seats"),
                rs.getBigDecimal("amount"),
                rs.getString("payment_status"),
                rs.getString("status"),
                rs.getString("category")
        ));
    }

    @Override
    public List<AdminBookingDto> getTripBookingRequestsForAdmin() {
        return jdbcTemplate.query("""
                SELECT
                    CONCAT('BK-', tb.trip_booking_id) AS booking_id,
                    COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''), u.email, CONCAT('User #', u.user_id)) AS passenger_name,
                    CONCAT(tb.start_location, ' - ', tb.destination) AS route,
                    COALESCE(b.bus_number, 'Pending assignment') AS bus,
                    COALESCE(b.bus_type, 'trip_booking') AS bus_type,
                    tb.start_date AS journey_date,
                    CAST('08:00:00' AS TIME) AS journey_time,
                    CONCAT(COALESCE(tb.passenger_count, 0), ' seats') AS seats,
                    COALESCE(tb.final_price, 0) AS amount,
                    'unpaid' AS payment_status,
                    tb.booking_status AS status,
                    'Trip Bookings' AS category
                FROM trip_booking tb
                JOIN passenger pa ON pa.passenger_id = tb.passenger_id
                JOIN `user` u ON u.user_id = pa.passenger_id
                LEFT JOIN bus b ON b.bus_id = tb.bus_id
                WHERE tb.booking_status IN ('pending', 'confirmed')
                  AND tb.bus_id IS NOT NULL
                  AND tb.negotiated_at IS NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM payment paid
                      WHERE paid.trip_booking_id = tb.trip_booking_id
                        AND paid.payment_status = 'success'
                  )
                ORDER BY tb.created_at ASC, tb.trip_booking_id ASC
                """, (rs, rowNum) -> new AdminBookingDto(
                rs.getString("booking_id"),
                rs.getString("passenger_name"),
                rs.getString("route"),
                rs.getString("bus"),
                rs.getString("bus_type"),
                rs.getDate("journey_date") != null ? rs.getDate("journey_date").toLocalDate() : null,
                rs.getTime("journey_time") != null ? rs.getTime("journey_time").toLocalTime() : null,
                rs.getString("seats"),
                rs.getBigDecimal("amount"),
                rs.getString("payment_status"),
                rs.getString("status"),
                rs.getString("category")
        ));
    }

    /**
     * Updates an existing booking
     * 
     * @param id The booking ID to update
     * @param dto The updated booking data
     * @return The updated booking DTO
     * @throws ResourceNotFoundException if booking doesn't exist
     */
    @Override
    public BookingDto update(Long id, BookingDto dto) {
        Booking entity = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));
        entity.setName(dto.getName());
        return toDto(repository.save(entity));
    }

    /**
     * Deletes a booking by ID
     * 
     * @param id The booking ID to delete
     */
    @Override
    public void delete(Long id) {
        repository.deleteById(id);
    }

    /**
     * Retrieves recent and upcoming bookings for a user
     * 
     * Fetches bookings that are either recent (past) or upcoming based on
     * the current date, filtered by user's email.
     * 
     * @param email The user's email address
     * @return List of recent/upcoming booking summaries
     */
    @Override
    public List<RecentBookingDto> getUpcomingForUser(String email) {
        return repository.findUpcomingRecentByEmail(email)
            .stream()
            .map(item -> {
                RecentBookingDto dto = new RecentBookingDto();
                dto.setBusNumber(item.getBusNumber());
                dto.setBusType(item.getBusType());
                dto.setBookingReference(item.getBookingReference());
                dto.setStartLocation(item.getStartLocation());
                dto.setEndLocation(item.getEndLocation());
                dto.setJourneyDate(item.getJourneyDate());
                dto.setJourneyTime(item.getJourneyTime());
                dto.setPaymentStatus(item.getPaymentStatus());
                return dto;
            })
            .toList();
    }

    /**
     * Retrieves all upcoming bookings for a user
     * 
     * @param email The user's email address
     * @return List of upcoming booking history DTOs
     */
    @Override
    public List<BookingHistoryDto> getUpcomingBookings(String email) {
        return repository.findUpcomingByEmail(email)
            .stream()
            .map(this::toHistoryDto)
            .toList();
    }

    /**
     * Retrieves all past bookings for a user
     * 
     * @param email The user's email address
     * @return List of past booking history DTOs
     */
    @Override
    public List<BookingHistoryDto> getPastBookings(String email) {
        return repository.findPastByEmail(email)
            .stream()
            .map(this::toHistoryDto)
            .toList();
    }

    /**
     * Converts a BookingHistoryProjection to BookingHistoryDto
     * 
     * Helper method for mapping database projection results to DTOs.
     * 
     * @param item The projection from the repository query
     * @return The corresponding DTO
     */
    private BookingHistoryDto toHistoryDto(BookingHistoryProjection item) {
        BookingHistoryDto dto = new BookingHistoryDto();
        dto.setBookingReference(item.getBookingReference());
        dto.setBusNumber(item.getBusNumber());
        dto.setBusType(item.getBusType());
        dto.setStartLocation(item.getStartLocation());
        dto.setEndLocation(item.getEndLocation());
        dto.setJourneyDate(item.getJourneyDate());
        dto.setJourneyTime(item.getJourneyTime());
        dto.setSeatNumber(item.getSeatNumber());
        dto.setTotalAmount(item.getTotalAmount());
        dto.setStatus(item.getStatus());
        dto.setTransactionId(item.getTransactionId());
        return dto;
    }

    /**
     * Converts a Booking entity to BookingDto
     * 
     * Helper method for mapping entity objects to data transfer objects.
     * 
     * @param entity The booking entity from the database
     * @return The corresponding DTO
     */
    private BookingDto toDto(Booking entity) {
        BookingDto dto = new BookingDto();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        return dto;
    }
}
