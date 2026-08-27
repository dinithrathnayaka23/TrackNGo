package com.trackngo.sos.internal.controller;

import com.trackngo.commons.ApiResponse;
import com.trackngo.sos.api.SosAlertService;
import com.trackngo.sos.api.dto.SosAlertDto;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

/**
 * Read-only history of SOS alerts for the admin web.
 *
 * This is kept apart from {@link SosAlertController}, whose endpoints are open so a
 * passenger or driver in trouble can raise an alert without a session. Past alerts name
 * the people involved and their phone numbers, so reading them stays behind an admin.
 */
@RestController
@RequestMapping("/api/admin/sos-alerts")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminSosAlertController {

    private final SosAlertService service;

    /** Returns alerts of any status, newest first, narrowed by the optional filters. */
    @GetMapping("/history")
    public ApiResponse<List<SosAlertDto>> history(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String triggeredBy
    ) {
        return ApiResponse.ok("Fetched", service.getAlertHistory(from, to, status, triggeredBy));
    }
}
