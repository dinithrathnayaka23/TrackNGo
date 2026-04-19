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

@RestController
@RequestMapping("/api/bookings")
@RequiredArgsConstructor
public class BookingController {
    private final BookingService service;
    private final JdbcTemplate jdbc;

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

    @PostMapping
    public ApiResponse<BookingDto> create(@Valid @RequestBody BookingDto dto) {
        return ApiResponse.ok("Created", service.create(dto));
    }

    @GetMapping
    public ApiResponse<List<BookingDto>> getAll() {
        return ApiResponse.ok("Fetched", service.getAll());
    }

    @GetMapping("/recent")
    public ApiResponse<List<RecentBookingDto>> getRecentUpcoming(
            Authentication authentication,
            @RequestParam(required = false) Long userId) {
        String email = resolveEmail(authentication, userId);
        return ApiResponse.ok("Fetched", service.getUpcomingForUser(email));
    }

    @GetMapping("/upcoming")
    public ApiResponse<List<BookingHistoryDto>> getUpcomingBookings(
            Authentication authentication,
            @RequestParam(required = false) Long userId) {
        String email = resolveEmail(authentication, userId);
        return ApiResponse.ok("Fetched", service.getUpcomingBookings(email));
    }

    @GetMapping("/past")
    public ApiResponse<List<BookingHistoryDto>> getPastBookings(
            Authentication authentication,
            @RequestParam(required = false) Long userId) {
        String email = resolveEmail(authentication, userId);
        return ApiResponse.ok("Fetched", service.getPastBookings(email));
    }

    @GetMapping("/{id}")
    public ApiResponse<BookingDto> get(@PathVariable Long id) {
        return ApiResponse.ok("Fetched", service.get(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<BookingDto> update(@PathVariable Long id, @Valid @RequestBody BookingDto dto) {
        return ApiResponse.ok("Updated", service.update(id, dto));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.ok("Deleted", null);
    }
}
