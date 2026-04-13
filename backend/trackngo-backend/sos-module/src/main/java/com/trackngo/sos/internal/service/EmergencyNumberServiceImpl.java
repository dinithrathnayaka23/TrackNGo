package com.trackngo.sos.internal.service;

import com.trackngo.commons.exception.ResourceNotFoundException;
import com.trackngo.sos.api.EmergencyNumberService;
import com.trackngo.sos.api.dto.EmergencyNumberDto;
import com.trackngo.sos.internal.entity.EmergencyNumber;
import com.trackngo.sos.internal.repository.EmergencyNumberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class EmergencyNumberServiceImpl implements EmergencyNumberService {
    private final EmergencyNumberRepository repository;

    @Override
    public EmergencyNumberDto getActiveEmergencyNumbers() {
        EmergencyNumber entity = repository.findByIsActiveTrue()
                .orElseThrow(() -> new ResourceNotFoundException("No active emergency numbers found"));
        return toDto(entity);
    }

    private EmergencyNumberDto toDto(EmergencyNumber entity) {
        EmergencyNumberDto dto = new EmergencyNumberDto();
        dto.setEmergencyId(entity.getEmergencyId());
        dto.setLabel(entity.getLabel());
        dto.setFireBrigade(entity.getFireBrigade());
        dto.setAmbulance(entity.getAmbulance());
        dto.setPolice(entity.getPolice());
        dto.setHelpCenter(entity.getHelpCenter());
        return dto;
    }
}
