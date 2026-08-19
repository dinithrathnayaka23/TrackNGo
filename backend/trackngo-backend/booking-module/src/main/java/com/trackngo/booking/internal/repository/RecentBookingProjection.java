package com.trackngo.booking.internal.repository;

import java.time.LocalDate;
import java.time.LocalTime;

public interface RecentBookingProjection {
    String getBusNumber();
    String getBusType();
    String getBookingReference();
    String getStartLocation();
    String getEndLocation();
    LocalDate getJourneyDate();
    LocalTime getJourneyTime();
    String getPaymentStatus();
}
