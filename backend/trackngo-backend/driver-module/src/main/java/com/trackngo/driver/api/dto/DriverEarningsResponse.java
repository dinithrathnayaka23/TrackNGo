package com.trackngo.driver.api.dto;

import java.math.BigDecimal;
import java.util.List;

public record DriverEarningsResponse(
        BigDecimal totalEarnings,
        BigDecimal monthlyEarnings,
        BigDecimal weeklyEarnings,
        BigDecimal previousWeeklyEarnings,
        BigDecimal percentageChange,
        List<DriverEarningDto> earnings,
        List<DriverEarningsDayDto> weeklyBreakdown
) {
}
