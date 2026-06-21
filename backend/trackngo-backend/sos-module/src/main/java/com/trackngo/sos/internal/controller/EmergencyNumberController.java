package com.trackngo.sos.internal.controller;

import com.trackngo.commons.ApiResponse;
import com.trackngo.sos.api.EmergencyNumberService;
import com.trackngo.sos.api.dto.AdminEmergencyNumberDtos.SaveEmergencyNumberRequest;
import com.trackngo.sos.api.dto.EmergencyNumberDto;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/emergency-numbers")
@RequiredArgsConstructor
public class EmergencyNumberController {
    private final EmergencyNumberService service;

    @GetMapping
    public ApiResponse<List<EmergencyNumberDto>> listEmergencyNumbers() {
        return ApiResponse.ok("Emergency numbers", service.listEmergencyNumbers());
    }

    @GetMapping("/active")
    public ApiResponse<EmergencyNumberDto> getActive() {
        return ApiResponse.ok("Fetched", service.getActiveEmergencyNumbers());
    }

    @PostMapping
    public ApiResponse<EmergencyNumberDto> createEmergencyNumber(@RequestBody SaveEmergencyNumberRequest request) {
        return ApiResponse.ok("Emergency number created", service.createEmergencyNumber(request));
    }

    @PutMapping("/{emergencyId}")
    public ApiResponse<EmergencyNumberDto> updateEmergencyNumber(
            @PathVariable Long emergencyId,
            @RequestBody SaveEmergencyNumberRequest request) {
        return ApiResponse.ok("Emergency number updated", service.updateEmergencyNumber(emergencyId, request));
    }
}
