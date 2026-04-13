package com.trackngo.booking.api.dto;

import lombok.Data;

import java.time.LocalDate;
import java.time.LocalTime;

@Data
public class RecentBookingDto {
    private String busNumber;
    private String busType;
    private String bookingReference;
    private String startLocation;
    private String endLocation;
    private LocalDate journeyDate;
    private LocalTime journeyTime;
}
