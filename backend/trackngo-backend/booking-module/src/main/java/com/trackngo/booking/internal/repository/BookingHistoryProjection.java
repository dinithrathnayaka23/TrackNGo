package com.trackngo.booking.internal.repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

public interface BookingHistoryProjection {
    String getBookingReference();
    String getBusNumber();
    String getBusType();
    String getStartLocation();
    String getEndLocation();
    LocalDate getJourneyDate();
    LocalTime getJourneyTime();
    String getSeatNumber();
    BigDecimal getTotalAmount();
    String getStatus();
    String getTransactionId();
}
