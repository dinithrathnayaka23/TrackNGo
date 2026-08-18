package com.trackngo.driver.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

public record DriverEarningDto(
        String id,
        String bookingReference,
        String route,
        LocalDate date,
        LocalTime time,
        BigDecimal amount
) {
}
