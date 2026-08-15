package com.trackngo.booking.internal.controller;

import com.trackngo.booking.api.dto.AnalyticsDtos.AnalyticsResponse;
import com.trackngo.booking.internal.service.AdminAnalyticsService;
import com.trackngo.commons.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

/** Aggregated booking analytics for the admin dashboard. */
@RestController
@RequestMapping("/api/admin/analytics")
@RequiredArgsConstructor
public class AdminAnalyticsController {

    private final AdminAnalyticsService adminAnalyticsService;

    /**
     * @param from inclusive start date; defaults to 29 days before {@code to}
     * @param to   inclusive end date; defaults to today
     */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<AnalyticsResponse> getAnalytics(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ApiResponse.ok("Fetched", adminAnalyticsService.getAnalytics(from, to));
    }
}
