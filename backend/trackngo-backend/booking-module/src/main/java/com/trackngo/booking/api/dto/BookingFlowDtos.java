package com.trackngo.booking.api.dto;

import java.math.BigDecimal;
import java.util.List;

/*
  Data Transfer Objects (DTOs) for the Booking Flow.
  These records define the structured data exchanged between the Mobile App and the Backend.
*/
public final class BookingFlowDtos {

    private BookingFlowDtos() {}

    /* Route search */
    /*
       Summary of a route found during initial route discovery.
    */
    public record RouteSearchResult(
            Long routeId,
            String routeName,
            String startLocation,
            String endLocation,
            String distance,
            String duration,
            BigDecimal fee
    ) {}

    /*Bus search results*/
    /*
      Represents a single bus option available for the user's search criteria.
      Includes real-time seat availability and segment-based fare.
    */
    public record BusSearchResult(
            Long busId,
            String busNumber,
            String busType,
            String busBrand,
            String startTime,
            String endTime,
            int seatCapacity,
            int availableSeats,
            List<String> amenities,
            BigDecimal fee,
            String driverName,
            Double driverRating,
            String routeName,
            String busRouteName,
            String routeStartLocation,
            String routeEndLocation,
            List<RouteStopInfo> routeStops
    ) {
        public record RouteStopInfo(String name, int priority) {}
    }

    /*Bus detail*/
    /*
      Detailed information about a specific bus, its route stops, and driver.
      Used when the user selects a bus to see the full itinerary.
    */
    public record BusDetailResult(
            Long busId,
            String busNumber,
            String busType,
            String busBrand,
            String startTime,
            String endTime,
            int seatCapacity,
            List<String> amenities,
            BigDecimal fee,
            String routeName,
            String busRouteName,
            String routeStartLocation,
            String routeEndLocation,
            String routeDistance,
            String routeDuration,
            List<RouteStopInfo> routeStops,
            DriverInfo driver
    ) {
        /*Info about a specific stop on the bus's route. */
        public record RouteStopInfo(String name, String estimatedTime, int priority) {}
        /* Info about the driver assigned to the bus. */
        public record DriverInfo(String name, String phoneNumber, Double rating, String profilePhoto) {}
    }

    /*Seat layout*/
    /*
      Represents a single row in the bus's seat layout.
      Used by the frontend to render the seat selection map.
    */
    public record SeatLayoutRow(
            int rowNum,
            List<String> left,
            List<String> right,
            List<String> lastRow
    ) {}

    /* ── Booked seats with passenger details ──────────────── */
    public record BookedSeatInfo(
            Long seatBookingId,
            String bookingReference,
            String journeyDate,
            String journeyTime,
            String seatNumber,
            String passengerName,
            Long passengerId,
            String passengerPhone,
            BigDecimal totalAmount,
            String status,
            String fromStop,
            String toStop,
            String specialRequest
    ) {}

    /* ── Seat layout data (individual seats) ──────────────── */
    public record SeatLayoutData(
            Long id,
            Long busId,
            String seatLabel,
            int rowNum,
            String positionGroup,
            int positionIndex,
            boolean blocked
    ) {}

    /* Create booking request.
       Payload sent by the mobile app to finalize a booking.
       Contains seat selections, payment details, and optional promotion info. */
    public record CreateBookingRequest(
            Long busId,
            String journeyDate,
            String journeyTime,
            List<String> seatNumbers,
            String specialRequest,
            String paymentMethod,
            BigDecimal totalAmount,
            Long passengerId,
            String fromLocation,
            String toLocation,
            BigDecimal originalAmount,
            BigDecimal discountAmount,
            Long promotionId,
            String promoCode
    ) {}

    /*Booking confirmation*/
    /*
      The response sent back after a successful booking.
      Contains the booking reference and transaction details for the user.
    */
    public record BookingConfirmationResult(
            String bookingReference,
            String status,
            String transactionId,
            String seatNumbers,
            BigDecimal totalAmount,
            String busNumber,
            String fromLocation,
            String toLocation,
            String journeyDate,
            String journeyTime
    ) {}
}

