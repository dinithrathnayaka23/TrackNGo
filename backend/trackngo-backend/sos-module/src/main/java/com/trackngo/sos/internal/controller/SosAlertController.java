package com.trackngo.sos.internal.controller;

import com.trackngo.commons.ApiResponse;
import com.trackngo.sos.api.SosAlertService;
import com.trackngo.sos.api.dto.SosAlertDto;
import com.trackngo.sos.api.dto.TriggerSosAlertRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sos-alerts")
@RequiredArgsConstructor
public class SosAlertController {

    private final SosAlertService service;

    /** Triggers a new SOS alert for the submitted passenger or driver. */
    @PostMapping("/trigger")
    public ApiResponse<SosAlertDto> trigger(@RequestBody TriggerSosAlertRequest request) {
        return ApiResponse.ok("Triggered", service.triggerAlert(request));
    }

    /** Returns the currently active SOS alerts for the admin dashboard. */
    @GetMapping("/active")
    public ApiResponse<List<SosAlertDto>> getActiveAlerts() {
        return ApiResponse.ok("Fetched", service.getActiveAlerts());
    }

    /** Resolves the selected SOS alert on behalf of the given admin. */
    @PutMapping("/{sosId}/resolve")
    public ApiResponse<SosAlertDto> resolve(
            @PathVariable("sosId") Long sosId,
            @RequestParam(value = "adminId", required = false) Long adminId) {
        return ApiResponse.ok("Resolved", service.resolveAlert(sosId, adminId));
    }

    /** Dismisses the selected SOS alert as a false alarm. */
    @PutMapping("/{sosId}/dismiss")
    public ApiResponse<SosAlertDto> dismiss(
            @PathVariable("sosId") Long sosId,
            @RequestParam(value = "adminId", required = false) Long adminId) {
        return ApiResponse.ok("Dismissed", service.dismissAlert(sosId, adminId));
    }
}
