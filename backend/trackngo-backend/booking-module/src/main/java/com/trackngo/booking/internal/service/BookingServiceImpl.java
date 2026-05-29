package com.trackngo.booking.internal.service;

import com.trackngo.booking.api.BookingService;
import com.trackngo.booking.api.dto.BookingDto;
import com.trackngo.booking.api.dto.BookingHistoryDto;
import com.trackngo.booking.api.dto.RecentBookingDto;
import com.trackngo.booking.events.BookingCreatedEvent;
import com.trackngo.booking.internal.entity.Booking;
import com.trackngo.booking.internal.repository.BookingHistoryProjection;
import com.trackngo.booking.internal.repository.BookingRepository;
import com.trackngo.commons.events.EventPublisher;
import com.trackngo.commons.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

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
