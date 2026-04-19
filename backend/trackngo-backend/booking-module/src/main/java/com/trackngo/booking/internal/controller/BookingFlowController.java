package com.trackngo.booking.internal.controller;

import com.trackngo.booking.api.dto.BookingFlowDtos.*;
import com.trackngo.booking.internal.service.BookingFlowService;
import com.trackngo.commons.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/booking-flow")
public class BookingFlowController {

    private final BookingFlowService service;

    public BookingFlowController(BookingFlowService service) {
        this.service = service;
    }

    @GetMapping("/search")
    public ApiResponse<List<BusSearchResult>> searchBuses(
            @RequestParam String from,
            @RequestParam String to,
            @RequestParam String date,
            @RequestParam(required = false) String busCategory
    ) {
        List<BusSearchResult> buses = service.searchBuses(from, to, date, busCategory);
        return ApiResponse.ok("Search results", buses);
    }

    @GetMapping("/buses/{busId}/details")
    public ApiResponse<BusDetailResult> getBusDetails(
            @PathVariable Long busId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to
    ) {
        BusDetailResult detail = service.getBusDetails(busId, from, to);
        return ApiResponse.ok("Bus details", detail);
    }

    @GetMapping("/buses/{busId}/seat-layout")
    public ApiResponse<List<SeatLayoutRow>> getSeatLayout(@PathVariable Long busId) {
        List<SeatLayoutRow> layout = service.getSeatLayout(busId);
        return ApiResponse.ok("Seat layout", layout);
    }

    @GetMapping("/buses/{busId}/booked-seats")
    public ApiResponse<List<String>> getBookedSeats(
            @PathVariable Long busId,
            @RequestParam String date
    ) {
        List<String> booked = service.getBookedSeats(busId, date);
        return ApiResponse.ok("Booked seats", booked);
    }

    @GetMapping("/buses/{busId}/blocked-seats")
    public ApiResponse<List<String>> getBlockedSeats(@PathVariable Long busId) {
        List<String> blocked = service.getBlockedSeats(busId);
        return ApiResponse.ok("Blocked seats", blocked);
    }

    @PostMapping("/bookings")
    public ApiResponse<BookingConfirmationResult> createBooking(
            @RequestBody @Valid CreateBookingRequest request
    ) {
        BookingConfirmationResult result = service.createBooking(request);
        return ApiResponse.ok("Booking created", result);
    }

    @GetMapping("/bookings/{bookingRef}")
    public ApiResponse<BookingConfirmationResult> getBooking(@PathVariable String bookingRef) {
        BookingConfirmationResult result = service.getBookingByRef(bookingRef);
        return ApiResponse.ok("Booking details", result);
    }

    @PutMapping("/bookings/{bookingRef}/cancel")
    public ApiResponse<Void> cancelBooking(@PathVariable String bookingRef) {
        service.cancelBooking(bookingRef);
        return ApiResponse.ok("Booking cancelled", null);
    }
}
