package com.trackngo.booking.internal.controller;

import com.trackngo.booking.api.BookingService;
import com.trackngo.booking.api.dto.AdminBookingDto;
import com.trackngo.commons.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Admin-only booking queries. The separate base path avoids the /{id} booking route. */
@RestController
@RequestMapping("/api/admin/bookings")
@RequiredArgsConstructor
public class AdminBookingController {
    private final BookingService bookingService;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<AdminBookingDto>> getAll() {
        return ApiResponse.ok("Fetched", bookingService.getAllForAdmin());
    }
}
