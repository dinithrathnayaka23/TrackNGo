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

    @PostMapping("/trigger")
    public ApiResponse<SosAlertDto> trigger(@RequestBody TriggerSosAlertRequest request) {
        return ApiResponse.ok("Triggered", service.triggerAlert(request));
    }

    @GetMapping("/active")
    public ApiResponse<List<SosAlertDto>> getActiveAlerts() {
        return ApiResponse.ok("Fetched", service.getActiveAlerts());
    }

    @PutMapping("/{sosId}/resolve")
    public ApiResponse<SosAlertDto> resolve(
            @PathVariable("sosId") Long sosId,
            @RequestParam(value = "adminId", required = false) Long adminId) {
        return ApiResponse.ok("Resolved", service.resolveAlert(sosId, adminId));
    }

    @PutMapping("/{sosId}/dismiss")
    public ApiResponse<SosAlertDto> dismiss(
            @PathVariable("sosId") Long sosId,
            @RequestParam(value = "adminId", required = false) Long adminId) {
        return ApiResponse.ok("Dismissed", service.dismissAlert(sosId, adminId));
    }
}
