package com.trackngo.booking.api.dto;

import java.math.BigDecimal;
import java.util.List;

public final class BookingFlowDtos {

    private BookingFlowDtos() {}

    /* ── Route search ─────────────────────────────────────── */
    public record RouteSearchResult(
            Long routeId,
            String routeName,
            String startLocation,
            String endLocation,
            String distance,
            String duration,
            BigDecimal fee
    ) {}

    /* ── Bus search results ───────────────────────────────── */
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
            String routeName
    ) {}

    /* ── Bus detail ───────────────────────────────────────── */
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
            List<RouteStopInfo> routeStops,
            DriverInfo driver
    ) {
        public record RouteStopInfo(String name, String estimatedTime, int priority) {}
        public record DriverInfo(String name, String phoneNumber, Double rating, String profilePhoto) {}
    }

    /* ── Seat layout ──────────────────────────────────────── */
    public record SeatLayoutRow(
            int rowNum,
            List<String> left,
            List<String> right,
            List<String> lastRow
    ) {}

    /* ── Create booking request ───────────────────────────── */
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
            String toLocation
    ) {}

    /* ── Booking confirmation ─────────────────────────────── */
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
