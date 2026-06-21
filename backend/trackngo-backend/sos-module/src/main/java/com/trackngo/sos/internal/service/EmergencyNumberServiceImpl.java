package com.trackngo.sos.internal.service;

import com.trackngo.commons.exception.BusinessException;
import com.trackngo.commons.exception.ResourceNotFoundException;
import com.trackngo.sos.api.EmergencyNumberService;
import com.trackngo.sos.api.dto.AdminEmergencyNumberDtos.SaveEmergencyNumberRequest;
import com.trackngo.sos.api.dto.EmergencyNumberDto;
import com.trackngo.sos.internal.entity.EmergencyNumber;
import com.trackngo.sos.internal.repository.EmergencyNumberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class EmergencyNumberServiceImpl implements EmergencyNumberService {
    private final EmergencyNumberRepository repository;

    /** Returns the first active emergency number row. */
    @Override
    public EmergencyNumberDto getActiveEmergencyNumbers() {
        EmergencyNumber entity = repository.findFirstByIsActiveTrueOrderByEmergencyIdAsc()
                .orElseThrow(() -> new ResourceNotFoundException("No active emergency numbers found"));
        return toDto(entity);
    }

    /** Returns all emergency number rows ordered for the admin dashboard. */
    @Override
    public List<EmergencyNumberDto> listEmergencyNumbers() {
        return repository.findAll(Sort.by(Sort.Direction.ASC, "emergencyId"))
                .stream()
                .map(this::toDto)
                .toList();
    }

    /** Creates a new emergency number row and keeps at least one row active. */
    @Override
    @Transactional
    public EmergencyNumberDto createEmergencyNumber(SaveEmergencyNumberRequest request) {
        validate(request);

        EmergencyNumber entity = new EmergencyNumber();
        applyRequest(entity, request);

        if (Boolean.TRUE.equals(request.isActive())) {
            repository.deactivateAll();
            entity.setIsActive(true);
        } else if (repository.countByIsActiveTrue() == 0) {
            entity.setIsActive(true);
        }

        return toDto(repository.save(entity));
    }

    /** Updates an existing emergency number row while preserving active-row rules. */
    @Override
    @Transactional
    public EmergencyNumberDto updateEmergencyNumber(Long emergencyId, SaveEmergencyNumberRequest request) {
        validate(request);

        EmergencyNumber entity = repository.findById(emergencyId)
                .orElseThrow(() -> new ResourceNotFoundException("Emergency number not found"));

        boolean wasActive = Boolean.TRUE.equals(entity.getIsActive());
        boolean shouldBeActive = Boolean.TRUE.equals(request.isActive());

        if (!shouldBeActive && wasActive && repository.countByIsActiveTrue() <= 1) {
            throw new BusinessException("At least one emergency number row must remain active");
        }

        applyRequest(entity, request);

        if (shouldBeActive) {
            repository.deactivateAllExcept(emergencyId);
            entity.setIsActive(true);
        }

        return toDto(repository.save(entity));
    }

    /** Validates the required fields for emergency number administration. */
    private void validate(SaveEmergencyNumberRequest request) {
        if (isBlank(request.label())
                || isBlank(request.fireBrigade())
                || isBlank(request.ambulance())
                || isBlank(request.police())
                || isBlank(request.helpCenter())) {
            throw new BusinessException("Label, fire brigade, ambulance, police, and help center are required");
        }
    }

    /** Checks whether a string is null, empty, or only whitespace. */
    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    /** Copies the normalized request values onto the entity. */
    private void applyRequest(EmergencyNumber entity, SaveEmergencyNumberRequest request) {
        entity.setLabel(request.label().trim());
        entity.setFireBrigade(request.fireBrigade().trim());
        entity.setAmbulance(request.ambulance().trim());
        entity.setPolice(request.police().trim());
        entity.setHelpCenter(request.helpCenter().trim());
        entity.setIsActive(Boolean.TRUE.equals(request.isActive()));
    }

    /** Converts the emergency number entity into the API DTO. */
    private EmergencyNumberDto toDto(EmergencyNumber entity) {
        EmergencyNumberDto dto = new EmergencyNumberDto();
        dto.setEmergencyId(entity.getEmergencyId());
        dto.setLabel(entity.getLabel());
        dto.setFireBrigade(entity.getFireBrigade());
        dto.setAmbulance(entity.getAmbulance());
        dto.setPolice(entity.getPolice());
        dto.setHelpCenter(entity.getHelpCenter());
        dto.setIsActive(entity.getIsActive());
        return dto;
    }
}
