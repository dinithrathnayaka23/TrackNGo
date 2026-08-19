package com.trackngo.booking.api.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

@Data
public class BookingHistoryDto {
    private String bookingReference;
    private String busNumber;
    private String busType;
    private String startLocation;
    private String endLocation;
    private LocalDate journeyDate;
    private LocalTime journeyTime;
    private String seatNumber;
    private BigDecimal totalAmount;
    private String status;
    private String transactionId;
    private String paymentStatus;
}
