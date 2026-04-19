package com.trackngo.booking.api.dto;

import java.math.BigDecimal;
import java.util.List;

public final class AdminBusDtos {

    private AdminBusDtos() {}

    /* ── Bus card for list page ───────────────────────────── */
    public record BusListItem(
            Long busId,
            String busNumber,
            String busBrand,
            int seatCapacity,
            String busType,
            String busCondition,
            String status,
            List<String> amenities,
            String driverName,
            Long driverId,
            String routeName,
            Long routeId,
            String startTime,
            String endTime,
            String registrationNumber,
            String insuranceExpDate
    ) {}

    /* ── Full bus detail ──────────────────────────────────── */
    public record BusDetail(
            Long busId,
            String busNumber,
            String busBrand,
            int seatCapacity,
            String busType,
            String busCondition,
            String status,
            List<String> amenities,
            String startTime,
            String endTime,
            String registrationNumber,
            String insuranceExpDate,
            Long driverId,
            String driverName,
            String driverPhone,
            Double driverRating,
            Long routeId,
            String routeName,
            BigDecimal routeFee
    ) {}

    /* ── Create / update bus request ──────────────────────── */
    public record SaveBusRequest(
            String busNumber,
            String busBrand,
            int seatCapacity,
            String busType,
            String busCondition,
            String status,
            List<String> amenities,
            String startTime,
            String endTime,
            String registrationNumber,
            String insuranceExpDate,
            Long driverId,
            Long routeId
    ) {}

    /* ── Seat layout row (matches mobile format) ─────────── */
    public record SeatLayoutRow(
            int rowNum,
            List<String> left,
            List<String> right,
            List<String> lastRow
    ) {}

    /* ── Save seat layout request ─────────────────────────── */
    public record SaveSeatLayoutRequest(
            List<SeatLayoutRow> rows,
            List<String> blockedSeats
    ) {}

    /* ── Simple dropdown items ────────────────────────────── */
    public record DriverOption(Long driverId, String name) {}
    public record RouteOption(Long routeId, String routeName) {}
}
