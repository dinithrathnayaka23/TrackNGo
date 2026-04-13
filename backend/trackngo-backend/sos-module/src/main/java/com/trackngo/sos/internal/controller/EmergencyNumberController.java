package com.trackngo.sos.internal.controller;

import com.trackngo.commons.ApiResponse;
import com.trackngo.sos.api.EmergencyNumberService;
import com.trackngo.sos.api.dto.EmergencyNumberDto;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/emergency-numbers")
@RequiredArgsConstructor
public class EmergencyNumberController {
    private final EmergencyNumberService service;

    @GetMapping("/active")
    public ApiResponse<EmergencyNumberDto> getActive() {
        return ApiResponse.ok("Fetched", service.getActiveEmergencyNumbers());
    }
}
