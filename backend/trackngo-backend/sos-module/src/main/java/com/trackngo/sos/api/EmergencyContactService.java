package com.trackngo.sos.api;

import com.trackngo.sos.api.dto.CreateEmergencyContactRequest;
import com.trackngo.sos.api.dto.EmergencyContactDto;

import java.util.List;

public interface EmergencyContactService {
    List<EmergencyContactDto> getContactsByOwner(Long ownerId, String ownerType);
    EmergencyContactDto addContact(CreateEmergencyContactRequest request);
    void deleteContact(Long contactId);
}
