package com.trackngo.sos.internal.controller;

import com.trackngo.commons.ApiResponse;
import com.trackngo.sos.api.EmergencyNumberService;
import com.trackngo.sos.api.dto.AdminEmergencyNumberDtos.SaveEmergencyNumberRequest;
import com.trackngo.sos.api.dto.EmergencyNumberDto;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/emergency-numbers")
public class AdminEmergencyNumberController {
    private final EmergencyNumberService service;

    public AdminEmergencyNumberController(EmergencyNumberService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<EmergencyNumberDto>> listEmergencyNumbers() {
        return ApiResponse.ok("Emergency numbers", service.listEmergencyNumbers());
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
