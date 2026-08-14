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

    /**
       1. Search for available buses.
       Matches buses that travel between 'from' and 'to' on a specific 'date'.
       Optionally filters by bus category (e.g., Luxury, Semi-Luxury).
    */
    @GetMapping("/search")// This is a HTTP GET request mapping to the /api/booking-flow/search URL
    public ApiResponse<List<BusSearchResult>> searchBuses(
            @RequestParam String from,
            @RequestParam String to,
            @RequestParam String date,
            @RequestParam(required = false) String busCategory
    ) {
        List<BusSearchResult> buses = service.searchBuses(from, to, date, busCategory);
        return ApiResponse.ok("Search results", buses);
    }

    /**
      2. Get detailed information for a specific bus.
      Includes route stops, driver info, and calculated fare for the segment.
    */
    @GetMapping("/buses/{busId}/details")
    public ApiResponse<BusDetailResult> getBusDetails(
            @PathVariable Long busId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to
    ) {
        BusDetailResult detail = service.getBusDetails(busId, from, to);
        return ApiResponse.ok("Bus details", detail);
    }

    /**
     * 3. Fetch the physical seat layout of the bus.
     * Returns the arrangement of seats (left, right, back rows).
     */
    @GetMapping("/buses/{busId}/seat-layout")
    public ApiResponse<List<SeatLayoutRow>> getSeatLayout(@PathVariable Long busId) {
        List<SeatLayoutRow> layout = service.getSeatLayout(busId);
        return ApiResponse.ok("Seat layout", layout);
    }

    /**
     * 4. Identify already booked seats for a specific bus and date.
     * Used on the seat selection screen to disable occupied seats.
     */
    @GetMapping("/buses/{busId}/booked-seats")
    public ApiResponse<List<String>> getBookedSeats(
            @PathVariable Long busId,
            @RequestParam String date
    ) {
        List<String> booked = service.getBookedSeats(busId, date);
        return ApiResponse.ok("Booked seats", booked);
    }

    @GetMapping("/buses/{busId}/booked-seats-details")
    public ApiResponse<List<BookedSeatInfo>> getBookedSeatsWithDetails(
            @PathVariable Long busId,
            @RequestParam String date
    ) {
        List<BookedSeatInfo> booked = service.getBookedSeatsWithDetails(busId, date);
        return ApiResponse.ok("Booked seats with details", booked);
    }

    /**
     * 5. Identify seats that are permanently blocked (e.g., for conductor or staff).
     */
    @GetMapping("/buses/{busId}/blocked-seats")
    public ApiResponse<List<String>> getBlockedSeats(@PathVariable Long busId) {
        List<String> blocked = service.getBlockedSeats(busId);
        return ApiResponse.ok("Blocked seats", blocked);
    }

    /**
     * 6. Finalize the booking and process payment.
     * Creates a seat_booking record and an associated payment record.
     */
    @PostMapping("/bookings")//Listens to HTTP POST request mapping to /api/booking-flow/bookings URL
    public ApiResponse<BookingConfirmationResult> createBooking(
            @RequestBody @Valid CreateBookingRequest request
    ) {//The @Valid annotation ensures that the request object is validated against its constraints
        BookingConfirmationResult result = service.createBooking(request);
        return ApiResponse.ok("Booking created", result);
    }

    /**
     * 7. Retrieve a specific booking confirmation by its reference number.
     */
    @GetMapping("/bookings/{bookingRef}")
    public ApiResponse<BookingConfirmationResult> getBooking(@PathVariable String bookingRef) {
        BookingConfirmationResult result = service.getBookingByRef(bookingRef);
        return ApiResponse.ok("Booking details", result);
    }

    /**
     * 8. Cancel an existing booking.
     * Updates the status to 'cancelled' so seats become available again.
     */
    @PutMapping("/bookings/{bookingRef}/cancel")
    public ApiResponse<Void> cancelBooking(@PathVariable String bookingRef) {
        service.cancelBooking(bookingRef);
        return ApiResponse.ok("Booking cancelled", null);
    }

    @PutMapping("/bookings/{seatBookingId}/boarded")
    public ApiResponse<Void> markPassengerBoarded(@PathVariable Long seatBookingId) {
        service.markPassengerBoarded(seatBookingId);
        return ApiResponse.ok("Passenger marked as boarded", null);
    }
}

