package com.trackngo.sos.api;

import com.trackngo.sos.api.dto.AdminEmergencyNumberDtos.SaveEmergencyNumberRequest;
import com.trackngo.sos.api.dto.EmergencyNumberDto;

import java.util.List;

public interface EmergencyNumberService {
    /** Returns the currently active emergency number row. */
    EmergencyNumberDto getActiveEmergencyNumbers();

    /** Returns every emergency number row for the admin dashboard. */
    List<EmergencyNumberDto> listEmergencyNumbers();

    /** Creates a new emergency number row from the admin request. */
    EmergencyNumberDto createEmergencyNumber(SaveEmergencyNumberRequest request);

    /** Updates an existing emergency number row by id. */
    EmergencyNumberDto updateEmergencyNumber(Long emergencyId, SaveEmergencyNumberRequest request);
}
