package com.trackngo.booking.internal.controller;

import com.trackngo.booking.api.BookingService;
import com.trackngo.booking.api.dto.BookingDto;
import com.trackngo.booking.api.dto.BookingHistoryDto;
import com.trackngo.booking.api.dto.RecentBookingDto;
import com.trackngo.commons.ApiResponse;
import com.trackngo.commons.exception.BusinessException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * BookingController - REST API endpoints for booking management
 * 
 * This controller handles all HTTP requests related to trip bookings in the TrackNGo system.
 * It provides endpoints for creating, retrieving, updating, and deleting bookings, as well as
 * fetching booking history for users. The controller integrates with Spring Security for
 * authentication and uses JDBC for user email resolution.
 * 
 * Key features:
 * - User authentication via Spring Security
 * - CRUD operations for bookings
 * - User-specific booking history (recent, upcoming, past)
 * - Validation using Jakarta Bean Validation
 * - Standardized API responses
 */
@RestController
@RequestMapping("/api/bookings")
@RequiredArgsConstructor
public class BookingController {
    private final BookingService service;
    private final JdbcTemplate jdbc;

    /**
     * Resolves the user's email from authentication context or user ID
     * 
     * This helper method extracts the authenticated user's email from the Spring Security
     * Authentication object. If not available, it queries the database using the provided
     * user ID. This is used for user-specific booking operations.
     * 
     * @param authentication The current authentication context
     * @param userId Optional user ID for fallback lookup
     * @return The user's email address
     * @throws BusinessException if user cannot be identified
     */
    private String resolveEmail(Authentication authentication, Long userId) {
        if (authentication != null
                && !(authentication instanceof AnonymousAuthenticationToken)
                && authentication.getName() != null
                && !authentication.getName().isBlank()) {
            return authentication.getName();
        }
        if (userId != null) {
            return jdbc.queryForObject(
                    "SELECT email FROM `user` WHERE user_id = ?", String.class, userId);
        }
        throw new BusinessException("Unauthorized request");
    }

    /**
     * Creates a new booking
     * 
     * Endpoint: POST /api/bookings
     * Validates the booking data and creates a new booking record in the system.
     * 
     * @param dto The booking data transfer object containing trip and passenger details
     * @return ApiResponse with the created booking information
     */
    @PostMapping
    public ApiResponse<BookingDto> create(@Valid @RequestBody BookingDto dto) {
        return ApiResponse.ok("Created", service.create(dto));
    }

    /**
     * Retrieves all bookings (admin endpoint)
     * 
     * Endpoint: GET /api/bookings
     * Returns a list of all bookings in the system. Typically used by administrators.
     * 
     * @return ApiResponse with list of all bookings
     */
    @GetMapping
    public ApiResponse<List<BookingDto>> getAll() {
        return ApiResponse.ok("Fetched", service.getAll());
    }

    /**
     * Retrieves recent and upcoming bookings for a user
     * 
     * Endpoint: GET /api/bookings/recent
     * Fetches bookings that are either recent (past) or upcoming for the authenticated user.
     * Uses authentication context or userId parameter for user identification.
     * 
     * @param authentication Current authentication context
     * @param userId Optional user ID parameter
     * @return ApiResponse with list of recent/upcoming bookings
     */
    @GetMapping("/recent")
    public ApiResponse<List<RecentBookingDto>> getRecentUpcoming(
            Authentication authentication,
            @RequestParam(required = false) Long userId) {
        String email = resolveEmail(authentication, userId);
        return ApiResponse.ok("Fetched", service.getUpcomingForUser(email));
    }

    /**
     * Retrieves upcoming bookings for a user
     * 
     * Endpoint: GET /api/bookings/upcoming
     * Fetches all future bookings for the authenticated user.
     * 
     * @param authentication Current authentication context
     * @param userId Optional user ID parameter
     * @return ApiResponse with list of upcoming bookings
     */
    @GetMapping("/upcoming")
    public ApiResponse<List<BookingHistoryDto>> getUpcomingBookings(
            Authentication authentication,
            @RequestParam(required = false) Long userId) {
        String email = resolveEmail(authentication, userId);
        return ApiResponse.ok("Fetched", service.getUpcomingBookings(email));
    }

    /**
     * Retrieves past bookings for a user
     * 
     * Endpoint: GET /api/bookings/past
     * Fetches all completed/past bookings for the authenticated user.
     * 
     * @param authentication Current authentication context
     * @param userId Optional user ID parameter
     * @return ApiResponse with list of past bookings
     */
    @GetMapping("/past")
    public ApiResponse<List<BookingHistoryDto>> getPastBookings(
            Authentication authentication,
            @RequestParam(required = false) Long userId) {
        String email = resolveEmail(authentication, userId);
        return ApiResponse.ok("Fetched", service.getPastBookings(email));
    }

    /**
     * Retrieves a specific booking by ID
     * 
     * Endpoint: GET /api/bookings/{id}
     * Fetches detailed information for a single booking.
     * 
     * @param id The booking ID
     * @return ApiResponse with the booking details
     */
    @GetMapping("/{id}")
    public ApiResponse<BookingDto> get(@PathVariable Long id) {
        return ApiResponse.ok("Fetched", service.get(id));
    }

    /**
     * Updates an existing booking
     * 
     * Endpoint: PUT /api/bookings/{id}
     * Modifies the details of an existing booking.
     * 
     * @param id The booking ID to update
     * @param dto The updated booking data
     * @return ApiResponse with the updated booking information
     */
    @PutMapping("/{id}")
    public ApiResponse<BookingDto> update(@PathVariable Long id, @Valid @RequestBody BookingDto dto) {
        return ApiResponse.ok("Updated", service.update(id, dto));
    }

    /**
     * Deletes a booking
     * 
     * Endpoint: DELETE /api/bookings/{id}
     * Removes a booking from the system.
     * 
     * @param id The booking ID to delete
     * @return ApiResponse confirming deletion
     */
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.ok("Deleted", null);
    }
}
