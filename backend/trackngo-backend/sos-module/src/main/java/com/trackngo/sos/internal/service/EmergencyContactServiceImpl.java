package com.trackngo.sos.internal.service;

import com.trackngo.commons.exception.ResourceNotFoundException;
import com.trackngo.sos.api.EmergencyContactService;
import com.trackngo.sos.api.dto.CreateEmergencyContactRequest;
import com.trackngo.sos.api.dto.EmergencyContactDto;
import com.trackngo.sos.internal.entity.EmergencyContact;
import com.trackngo.sos.internal.repository.EmergencyContactRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class EmergencyContactServiceImpl implements EmergencyContactService {
    private final EmergencyContactRepository repository;

    /** Loads the owner's emergency contacts and maps them into DTOs. */
    @Override
    public List<EmergencyContactDto> getContactsByOwner(Long ownerId, String ownerType) {
        return repository.findByOwnerIdAndOwnerTypeOrderByCreatedAtDesc(ownerId, ownerType)
                .stream()
                .map(this::toDto)
                .toList();
    }

    /** Saves a new emergency contact after normalizing the owner type. */
    @Override
    public EmergencyContactDto addContact(CreateEmergencyContactRequest request) {
        EmergencyContact entity = new EmergencyContact();
        entity.setOwnerId(request.getOwnerId());
        entity.setOwnerType(request.getOwnerType().toLowerCase());
        entity.setName(request.getName());
        entity.setTeleNumber(request.getTeleNumber());
        entity.setRelationship(request.getRelationship());
        return toDto(repository.save(entity));
    }

    /** Deletes the selected emergency contact if it exists. */
    @Override
    public void deleteContact(Long contactId) {
        if (!repository.existsById(contactId)) {
            throw new ResourceNotFoundException("Emergency contact not found");
        }
        repository.deleteById(contactId);
    }

    /** Converts the emergency contact entity into the API DTO. */
    private EmergencyContactDto toDto(EmergencyContact entity) {
        EmergencyContactDto dto = new EmergencyContactDto();
        dto.setContactId(entity.getContactId());
        dto.setOwnerId(entity.getOwnerId());
        dto.setOwnerType(entity.getOwnerType());
        dto.setName(entity.getName());
        dto.setTeleNumber(entity.getTeleNumber());
        dto.setRelationship(entity.getRelationship());
        return dto;
    }
}
