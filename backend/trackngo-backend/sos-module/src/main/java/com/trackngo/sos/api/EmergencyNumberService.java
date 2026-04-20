package com.trackngo.sos.api;

import com.trackngo.sos.api.dto.AdminEmergencyNumberDtos.SaveEmergencyNumberRequest;
import com.trackngo.sos.api.dto.EmergencyNumberDto;

import java.util.List;

public interface EmergencyNumberService {
    EmergencyNumberDto getActiveEmergencyNumbers();
    List<EmergencyNumberDto> listEmergencyNumbers();
    EmergencyNumberDto createEmergencyNumber(SaveEmergencyNumberRequest request);
    EmergencyNumberDto updateEmergencyNumber(Long emergencyId, SaveEmergencyNumberRequest request);
}
