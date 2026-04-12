package com.trackngo.booking.internal.controller;

import com.trackngo.booking.api.BookingService;
import com.trackngo.booking.api.dto.BookingDto;
import com.trackngo.booking.api.dto.RecentBookingDto;
import com.trackngo.commons.ApiResponse;
import com.trackngo.commons.exception.BusinessException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/bookings")
@RequiredArgsConstructor
public class BookingController {
    private final BookingService service;

    @PostMapping
    public ApiResponse<BookingDto> create(@Valid @RequestBody BookingDto dto) {
        return ApiResponse.ok("Created", service.create(dto));
    }

    @GetMapping("/{id}")
    public ApiResponse<BookingDto> get(@PathVariable Long id) {
        return ApiResponse.ok("Fetched", service.get(id));
    }

    @GetMapping
    public ApiResponse<List<BookingDto>> getAll() {
        return ApiResponse.ok("Fetched", service.getAll());
    }

    @GetMapping("/recent")
    public ApiResponse<List<RecentBookingDto>> getRecentUpcoming(Authentication authentication) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            throw new BusinessException("Unauthorized request");
        }
        return ApiResponse.ok("Fetched", service.getUpcomingForUser(authentication.getName()));
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
