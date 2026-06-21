package com.trackngo.sos.api;

import com.trackngo.sos.api.dto.CreateEmergencyContactRequest;
import com.trackngo.sos.api.dto.EmergencyContactDto;

import java.util.List;

public interface EmergencyContactService {
    /** Returns the emergency contacts owned by the given passenger or driver. */
    List<EmergencyContactDto> getContactsByOwner(Long ownerId, String ownerType);

    /** Creates a new emergency contact for the requested owner. */
    EmergencyContactDto addContact(CreateEmergencyContactRequest request);

    /** Deletes an emergency contact by id. */
    void deleteContact(Long contactId);
}
