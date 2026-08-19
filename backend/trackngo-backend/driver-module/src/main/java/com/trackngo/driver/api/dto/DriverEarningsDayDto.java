package com.trackngo.driver.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record DriverEarningsDayDto(
        LocalDate date,
        BigDecimal amount
) {
}
